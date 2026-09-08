import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  decodePitchContent,
  emptyPitchDocument,
  preservePitchMoments,
  type PitchDoc,
  type PitchDocument,
} from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"

import { getPitch, pitchQueryKeys, updatePitch } from "./pitch-api.ts"

function contentFromDoc(doc: PitchDoc | null | undefined): PitchDocument {
  if (!doc) return emptyPitchDocument()
  const decoded = decodePitchContent(doc.kind, doc.contentVersion, doc.content)
  return decoded.ok ? decoded.data : emptyPitchDocument()
}

function pitchContentEquals(left: unknown, right: PitchDocument) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "Something went wrong"
}

export function usePitch() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const writeChain = useRef(Promise.resolve())

  const query = useQuery({
    queryKey: pitchQueryKeys.current(),
    queryFn: async () => {
      try {
        return await getPitch()
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null
        }
        throw err
      }
    },
  })

  const mutation = useMutation({
    mutationFn: (content: PitchDocument) =>
      updatePitch({
        content,
        contentVersion:
          queryClient.getQueryData<PitchDoc | null>(pitchQueryKeys.current())
            ?.contentVersion ?? 1,
      }),
    onMutate: async (content) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: pitchQueryKeys.current() })
      const previous = queryClient.getQueryData<PitchDoc | null>(
        pitchQueryKeys.current()
      )
      const now = new Date().toISOString()
      const optimistic: PitchDoc = {
        id: previous?.id ?? "optimistic-pitch",
        kind: "pitch",
        content,
        contentVersion: previous?.contentVersion ?? 1,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      }
      queryClient.setQueryData(pitchQueryKeys.current(), optimistic)
      return { previous }
    },
    onError: (err, _content, ctx) => {
      queryClient.setQueryData(pitchQueryKeys.current(), ctx?.previous)
      setError(errorMessage(err))
    },
    onSuccess: (next) => {
      queryClient.setQueryData(pitchQueryKeys.current(), next)
    },
  })

  const persist = useCallback(
    (patch: (current: PitchDocument) => PitchDocument) => {
      writeChain.current = writeChain.current.then(async () => {
        const stored = queryClient.getQueryData<PitchDoc | null>(
          pitchQueryKeys.current()
        )
        const current = contentFromDoc(stored)
        await mutation
          .mutateAsync(preservePitchMoments(current, patch(current)))
          .catch(() => undefined)
      })
    },
    [mutation, queryClient]
  )

  useEffect(() => {
    const doc = query.data
    if (!doc || query.isPending || mutation.isPending) return
    const decoded = decodePitchContent(doc.kind, doc.contentVersion, doc.content)
    if (!decoded.ok || pitchContentEquals(doc.content, decoded.data)) return
    persist(() => decoded.data)
  }, [mutation.isPending, persist, query.data, query.isPending])

  return {
    doc: query.data,
    content: contentFromDoc(query.data),
    isLoading: query.isPending,
    error,
    dismissError: () => setError(null),
    persist,
  }
}
