import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import type {
  PaperContentKind,
  PaperDoc,
  PaperDocStatus,
} from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"

import {
  createPaperDoc,
  deletePaperDoc,
  listPaperDocs,
  paperQueryKeys,
  renamePaperDoc,
  setPaperDocStatus,
  updatePaperContent,
  upsertPaperDoc,
} from "./paper-api.ts"

const EMPTY_DOCS: PaperDoc[] = []

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "Something went wrong"
}

export function usePaperDocs() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [revertKey, setRevertKey] = useState(0)

  const listQuery = useQuery({
    queryKey: paperQueryKeys.list(),
    queryFn: listPaperDocs,
  })
  const docs = listQuery.data ?? EMPTY_DOCS

  const rollback = useCallback(
    (previous: PaperDoc[] | undefined) => {
      queryClient.setQueryData(paperQueryKeys.list(), previous)
      setRevertKey((key) => key + 1)
    },
    [queryClient]
  )

  const createMutation = useMutation({
    mutationFn: (kind: PaperContentKind) => createPaperDoc({ kind }),
    onMutate: () => {
      setError(null)
    },
    onError: (err) => {
      setError(errorMessage(err))
    },
    onSuccess: (created) => {
      queryClient.setQueryData(
        paperQueryKeys.list(),
        (prev: PaperDoc[] | undefined) => upsertPaperDoc(prev ?? [], created)
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (doc: PaperDoc) =>
      updatePaperContent({
        docId: doc.id,
        content: doc.content,
        contentVersion: doc.contentVersion,
      }),
    onMutate: async (doc) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: paperQueryKeys.list() })
      const previous = queryClient.getQueryData<PaperDoc[]>(
        paperQueryKeys.list()
      )
      const optimistic: PaperDoc = {
        ...doc,
        updatedAt: new Date().toISOString(),
      }
      queryClient.setQueryData(
        paperQueryKeys.list(),
        upsertPaperDoc(previous ?? [], optimistic)
      )
      return { previous }
    },
    onError: (err, _doc, ctx) => {
      rollback(ctx?.previous)
      setError(errorMessage(err))
    },
    onSuccess: (next) => {
      queryClient.setQueryData(
        paperQueryKeys.list(),
        (prev: PaperDoc[] | undefined) => upsertPaperDoc(prev ?? [], next)
      )
    },
  })

  const renameMutation = useMutation({
    mutationFn: (input: { docId: string; name: string }) =>
      renamePaperDoc(input),
    onMutate: async ({ docId, name }) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: paperQueryKeys.list() })
      const previous = queryClient.getQueryData<PaperDoc[]>(
        paperQueryKeys.list()
      )
      queryClient.setQueryData(
        paperQueryKeys.list(),
        (prev: PaperDoc[] | undefined) =>
          (prev ?? []).map((doc) =>
            doc.id === docId
              ? { ...doc, name, updatedAt: new Date().toISOString() }
              : doc
          )
      )
      return { previous }
    },
    onError: (err, _input, ctx) => {
      rollback(ctx?.previous)
      setError(errorMessage(err))
    },
    onSuccess: (next) => {
      queryClient.setQueryData(
        paperQueryKeys.list(),
        (prev: PaperDoc[] | undefined) => upsertPaperDoc(prev ?? [], next)
      )
    },
  })

  const statusMutation = useMutation({
    mutationFn: (input: { docId: string; status: PaperDocStatus }) =>
      setPaperDocStatus(input),
    onMutate: async ({ docId, status }) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: paperQueryKeys.list() })
      const previous = queryClient.getQueryData<PaperDoc[]>(
        paperQueryKeys.list()
      )
      queryClient.setQueryData(
        paperQueryKeys.list(),
        (prev: PaperDoc[] | undefined) =>
          (prev ?? []).map((doc) =>
            doc.id === docId
              ? { ...doc, status, updatedAt: new Date().toISOString() }
              : doc
          )
      )
      return { previous }
    },
    onError: (err, _input, ctx) => {
      rollback(ctx?.previous)
      setError(errorMessage(err))
    },
    onSuccess: (next) => {
      queryClient.setQueryData(
        paperQueryKeys.list(),
        (prev: PaperDoc[] | undefined) => upsertPaperDoc(prev ?? [], next)
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => deletePaperDoc({ docId }),
    onMutate: async (docId) => {
      setError(null)
      await queryClient.cancelQueries({ queryKey: paperQueryKeys.list() })
      const previous = queryClient.getQueryData<PaperDoc[]>(
        paperQueryKeys.list()
      )
      queryClient.setQueryData(
        paperQueryKeys.list(),
        (prev: PaperDoc[] | undefined) =>
          (prev ?? []).filter((doc) => doc.id !== docId)
      )
      return { previous }
    },
    onError: (err, _docId, ctx) => {
      rollback(ctx?.previous)
      setError(errorMessage(err))
    },
  })

  return {
    docs,
    isLoading: listQuery.isPending,
    error,
    revertKey,
    dismissError: () => setError(null),
    createDoc: (kind: PaperContentKind) => createMutation.mutateAsync(kind),
    creating: createMutation.isPending,
    updateContent: (doc: PaperDoc) => {
      updateMutation.mutate(doc)
    },
    renameDoc: (docId: string, name: string) => {
      renameMutation.mutate({ docId, name })
    },
    setStatus: (docId: string, status: PaperDocStatus) => {
      statusMutation.mutate({ docId, status })
    },
    deleteDoc: (docId: string) => deleteMutation.mutateAsync(docId),
  }
}
