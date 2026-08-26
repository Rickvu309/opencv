import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  appendCoachPart,
  textFromParts,
  type CoachUsageRating,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type ThreadMessagePart,
} from "@workspace/domain"

import { coachSendErrorMessage } from "@/features/home/coach-error.ts"
import { useCoachMode } from "@/features/home/use-coach-mode.ts"
import {
  createThread,
  getThread,
  getThreadByFocusDoc,
  rateCoachMessage,
  reverseCoachReceipt,
  streamCoachRegenerate,
  streamCoachTurn,
  threadQueryKeys,
  toListItem,
  upsertThreadListItem,
} from "@/features/home/thread-api.ts"
import type { TurnPhase } from "@/features/home/thread-store-context.ts"
import {
  STREAMING_COACH_ID,
  toHomeMessages,
  type HomeMessage,
} from "@/features/home/threads.ts"
import { isAbortError } from "@/lib/sse.ts"

import { paperQueryKeys } from "./paper-api.ts"

type SendError = {
  message: string
  userMessageId: string
  text: string
  local: boolean
}

export function usePaperCoach(docId: string, docName: string) {
  const queryClient = useQueryClient()
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null)
  const [optimisticMessages, setOptimisticMessages] = useState<
    HomeMessage[] | null
  >(null)
  const [phase, setPhase] = useState<TurnPhase>("idle")
  const [sendError, setSendError] = useState<SendError | null>(null)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const sendGeneration = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const { mode } = useCoachMode()

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sendGeneration.current += 1
    setCreatedThreadId(null)
    setOptimisticMessages(null)
    setSendError(null)
    setRegenerateError(null)
    setPhase("idle")
  }, [docId])

  const focusedThreadQuery = useQuery({
    queryKey: threadQueryKeys.byFocusDoc(docId),
    queryFn: () => getThreadByFocusDoc(docId),
    staleTime: Infinity,
  })

  const threadId = createdThreadId ?? focusedThreadQuery.data?.id ?? null

  const detailQuery = useQuery({
    queryKey: threadQueryKeys.detail(threadId ?? ""),
    queryFn: () => getThread(threadId!),
    enabled: Boolean(threadId) && phase === "idle",
    staleTime: Infinity,
  })

  const messages = useMemo(() => {
    const base =
      optimisticMessages ??
      (detailQuery.data ? toHomeMessages(detailQuery.data.messages) : [])
    if (!sendError) return base
    return base.map((message) =>
      message.id === sendError.userMessageId
        ? { ...message, failed: true, error: sendError.message }
        : message
    )
  }, [detailQuery.data, optimisticMessages, sendError])

  const actionError = sendError ? null : regenerateError

  const writeDetail = useCallback(
    (id: string, detail: ThreadDetail) => {
      queryClient.setQueryData(threadQueryKeys.detail(id), detail)
      queryClient.setQueryData(
        threadQueryKeys.list(),
        (prev: ThreadListItem[] | undefined) =>
          upsertThreadListItem(prev ?? [], toListItem(detail))
      )
    },
    [queryClient]
  )

  const hydrateThread = useCallback(
    async (
      id: string,
      fallback?: ThreadMessage
    ): Promise<ThreadDetail | undefined> => {
      try {
        const detail = await getThread(id)
        writeDetail(id, detail)
        return detail
      } catch {
        if (!fallback) return undefined
        const prev = queryClient.getQueryData<ThreadDetail>(
          threadQueryKeys.detail(id)
        )
        if (!prev) return undefined
        const already = prev.messages.some((item) => item.id === fallback.id)
        const next: ThreadDetail = {
          ...prev,
          updatedAt: fallback.createdAt,
          messages: already
            ? prev.messages.map((item) =>
                item.id === fallback.id ? fallback : item
              )
            : [...prev.messages, fallback],
        }
        writeDetail(id, next)
        return next
      }
    },
    [queryClient, writeDetail]
  )

  const keepStreamedCoach = useCallback(
    (id: string, user: HomeMessage | undefined, parts: ThreadMessagePart[]) => {
      const now = new Date().toISOString()
      const coachText = textFromParts(parts)
      const prev = queryClient.getQueryData<ThreadDetail>(
        threadQueryKeys.detail(id)
      )
      const hasText = prev?.messages.some(
        (message) => message.role === "coach" && message.text === coachText
      )
      if (hasText && prev) return

      const userRow: ThreadMessage | undefined = user
        ? {
            id: user.id,
            role: "user",
            text: user.text,
            createdAt: now,
          }
        : undefined
      const coachRow: ThreadMessage = {
        id: crypto.randomUUID(),
        role: "coach",
        text: coachText,
        createdAt: now,
        status: "aborted",
        parts,
      }

      const existing = prev?.messages ?? []
      const hasUser =
        userRow != null &&
        existing.some(
          (message) => message.role === "user" && message.text === userRow.text
        )
      writeDetail(id, {
        id,
        title: prev?.title ?? docName,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        focusDocId: prev?.focusDocId ?? docId,
        messages: [
          ...(hasUser || !userRow ? existing : [...existing, userRow]),
          ...(hasText ? [] : [coachRow]),
        ],
      })
    },
    [docId, docName, queryClient, writeDetail]
  )

  const rememberPaperTools = useCallback(
    (parts: ThreadMessagePart[]) => {
      if (parts.some((part) => part.type === "tool" && part.name.startsWith("paper_"))) {
        void queryClient.invalidateQueries({ queryKey: paperQueryKeys.all })
      }
    },
    [queryClient]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const send = useCallback(
    (text: string, retrying = false) => {
      const trimmed = text.trim()
      if (!trimmed || phase !== "idle") return false

      const generation = ++sendGeneration.current
      const controller = new AbortController()
      abortRef.current = controller

      const current =
        optimisticMessages ??
        (detailQuery.data ? toHomeMessages(detailQuery.data.messages) : [])
      const baseline = current.filter((message) => {
        if (message.id === STREAMING_COACH_ID) return false
        if (
          retrying &&
          sendError?.local &&
          message.id === sendError.userMessageId
        ) {
          return false
        }
        return true
      })

      const userMessage: HomeMessage = {
        id: `local-${crypto.randomUUID()}`,
        role: "user",
        text: trimmed,
      }

      setSendError(null)
      setRegenerateError(null)
      setOptimisticMessages([...baseline, userMessage])
      setPhase("waiting")

      const paint = (parts: ThreadMessagePart[]) => {
        setOptimisticMessages([
          ...baseline,
          userMessage,
          ...(parts.length > 0
            ? [
                {
                  id: STREAMING_COACH_ID,
                  role: "coach" as const,
                  text: textFromParts(parts),
                  parts,
                },
              ]
            : []),
        ])
      }

      void (async () => {
        let streamedParts: ThreadMessagePart[] = []
        let ended: ThreadMessage | undefined
        let streamError: string | undefined
        let id = threadId

        try {
          if (!id) {
            const existing = await getThreadByFocusDoc(docId)
            if (generation !== sendGeneration.current) return
            if (existing) {
              queryClient.setQueryData(
                threadQueryKeys.byFocusDoc(docId),
                existing
              )
              queryClient.setQueryData(
                threadQueryKeys.list(),
                (prev: ThreadListItem[] | undefined) =>
                  upsertThreadListItem(prev ?? [], existing)
              )
              id = existing.id
              setCreatedThreadId(id)
            } else {
              const created = await createThread({
                title: docName,
                focusDocId: docId,
              })
              queryClient.setQueryData(
                threadQueryKeys.list(),
                (prev: ThreadListItem[] | undefined) =>
                  upsertThreadListItem(prev ?? [], created)
              )
              queryClient.setQueryData(
                threadQueryKeys.byFocusDoc(docId),
                created
              )
              if (generation !== sendGeneration.current) return
              id = created.id
              setCreatedThreadId(id)
            }
          }

          await streamCoachTurn(
            id,
            trimmed,
            {
              onTextDelta({ text: delta }) {
                if (generation !== sendGeneration.current) return
                streamedParts = appendCoachPart(streamedParts, {
                  type: "text-delta",
                  text: delta,
                })
                setPhase("streaming")
                paint(streamedParts)
              },
              onToolResult(data) {
                if (generation !== sendGeneration.current) return
                streamedParts = appendCoachPart(streamedParts, {
                  type: "tool-result",
                  ...data,
                })
                setPhase("streaming")
                paint(streamedParts)
              },
              onMessageEnd({ message }) {
                ended = message
              },
              onError({ message }) {
                streamError = message
              },
            },
            controller.signal,
            mode,
            docId
          )

          if (generation !== sendGeneration.current) return
          rememberPaperTools(streamedParts)

          if (ended) {
            await hydrateThread(id, ended)
            if (generation !== sendGeneration.current) return
            if (streamError) {
              const detail = queryClient.getQueryData<ThreadDetail>(
                threadQueryKeys.detail(id)
              )
              const lastUser = [...(detail?.messages ?? [])]
                .reverse()
                .find((message) => message.role === "user")
              setSendError({
                message: streamError,
                userMessageId: lastUser?.id ?? userMessage.id,
                text: trimmed,
                local: false,
              })
              setOptimisticMessages(null)
              setPhase("idle")
              return
            }
            setOptimisticMessages(null)
            setPhase("idle")
            return
          }

          if (controller.signal.aborted) {
            await hydrateThread(id)
            if (generation !== sendGeneration.current) return
            if (streamedParts.length > 0) {
              keepStreamedCoach(id, userMessage, streamedParts)
            }
            const detail = queryClient.getQueryData<ThreadDetail>(
              threadQueryKeys.detail(id)
            )
            setOptimisticMessages(
              detail ? toHomeMessages(detail.messages) : null
            )
            setPhase("idle")
            return
          }

          if (streamError) {
            setSendError({
              message: streamError,
              userMessageId: userMessage.id,
              text: trimmed,
              local: false,
            })
            setPhase("idle")
            return
          }

          await hydrateThread(id)
          if (generation !== sendGeneration.current) return
          setOptimisticMessages(null)
          setPhase("idle")
        } catch (error) {
          if (generation !== sendGeneration.current) return
          if (isAbortError(error) || controller.signal.aborted) {
            if (id) {
              await hydrateThread(id)
              if (generation !== sendGeneration.current) return
              if (streamedParts.length > 0) {
                keepStreamedCoach(id, userMessage, streamedParts)
              }
              const detail = queryClient.getQueryData<ThreadDetail>(
                threadQueryKeys.detail(id)
              )
              setOptimisticMessages(
                detail ? toHomeMessages(detail.messages) : null
              )
            } else {
              setOptimisticMessages(null)
            }
            setPhase("idle")
            return
          }

          setSendError({
            message: coachSendErrorMessage(error),
            userMessageId: userMessage.id,
            text: trimmed,
            local: true,
          })
          setPhase("idle")
        } finally {
          if (generation === sendGeneration.current) {
            abortRef.current = null
          }
        }
      })()

      return true
    },
    [
      detailQuery.data,
      docId,
      docName,
      hydrateThread,
      keepStreamedCoach,
      mode,
      optimisticMessages,
      phase,
      queryClient,
      rememberPaperTools,
      sendError,
      threadId,
    ]
  )

  const regenerate = useCallback(() => {
    if (phase !== "idle") return false
    const id = threadId
    if (!id) return false

    const current =
      optimisticMessages ??
      (detailQuery.data ? toHomeMessages(detailQuery.data.messages) : [])
    const baseline = current.filter(
      (message) => message.id !== STREAMING_COACH_ID
    )
    const lastCoach = [...baseline]
      .reverse()
      .find((message) => message.role === "coach")
    if (!lastCoach) return false
    const lastUser = [...baseline]
      .reverse()
      .find((message) => message.role === "user")

    const generation = ++sendGeneration.current
    const controller = new AbortController()
    abortRef.current = controller

    setSendError(null)
    setRegenerateError(null)
    setOptimisticMessages(baseline)
    setPhase("waiting")

    const paint = (parts: ThreadMessagePart[]) => {
      setOptimisticMessages([
        ...baseline,
        ...(parts.length > 0
          ? [
              {
                id: STREAMING_COACH_ID,
                role: "coach" as const,
                text: textFromParts(parts),
                parts,
              },
            ]
          : []),
      ])
    }

    void (async () => {
      let streamedParts: ThreadMessagePart[] = []
      let ended: ThreadMessage | undefined
      let streamError: string | undefined

      try {
        await streamCoachRegenerate(
          id,
          {
            onTextDelta({ text: delta }) {
              if (generation !== sendGeneration.current) return
              streamedParts = appendCoachPart(streamedParts, {
                type: "text-delta",
                text: delta,
              })
              setPhase("streaming")
              paint(streamedParts)
            },
            onToolResult(data) {
              if (generation !== sendGeneration.current) return
              streamedParts = appendCoachPart(streamedParts, {
                type: "tool-result",
                ...data,
              })
              setPhase("streaming")
              paint(streamedParts)
            },
            onMessageEnd({ message }) {
              ended = message
            },
            onError({ message }) {
              streamError = message
            },
          },
          controller.signal,
          mode,
          docId
        )

        if (generation !== sendGeneration.current) return
        rememberPaperTools(streamedParts)

        if (ended) {
          await hydrateThread(id, ended)
          if (generation !== sendGeneration.current) return
          if (streamError) {
            setRegenerateError(streamError)
          }
          setOptimisticMessages(null)
          setPhase("idle")
          return
        }

        if (controller.signal.aborted) {
          await hydrateThread(id)
          if (generation !== sendGeneration.current) return
          if (streamedParts.length > 0) {
            keepStreamedCoach(id, lastUser, streamedParts)
          }
          const detail = queryClient.getQueryData<ThreadDetail>(
            threadQueryKeys.detail(id)
          )
          setOptimisticMessages(
            detail ? toHomeMessages(detail.messages) : null
          )
          setPhase("idle")
          return
        }

        if (streamError) {
          setRegenerateError(streamError)
          setOptimisticMessages(null)
          setPhase("idle")
          return
        }

        await hydrateThread(id)
        if (generation !== sendGeneration.current) return
        setOptimisticMessages(null)
        setPhase("idle")
      } catch (error) {
        if (generation !== sendGeneration.current) return
        if (isAbortError(error) || controller.signal.aborted) {
          await hydrateThread(id)
          if (generation !== sendGeneration.current) return
          if (streamedParts.length > 0) {
            keepStreamedCoach(id, lastUser, streamedParts)
          }
          const detail = queryClient.getQueryData<ThreadDetail>(
            threadQueryKeys.detail(id)
          )
          setOptimisticMessages(
            detail ? toHomeMessages(detail.messages) : null
          )
          setPhase("idle")
          return
        }

        setRegenerateError(coachSendErrorMessage(error))
        setOptimisticMessages(null)
        setPhase("idle")
      } finally {
        if (generation === sendGeneration.current) {
          abortRef.current = null
        }
      }
    })()

    return true
  }, [
    detailQuery.data,
    docId,
    hydrateThread,
    keepStreamedCoach,
    mode,
    optimisticMessages,
    phase,
    queryClient,
    rememberPaperTools,
    threadId,
  ])

  const retry = useCallback(() => {
    if (phase !== "idle") return false
    if (regenerateError) return regenerate()
    if (!sendError) return false
    return send(sendError.text, true)
  }, [phase, regenerate, regenerateError, send, sendError])

  const rate = useCallback(
    (messageId: string, rating: CoachUsageRating) => {
      const id = threadId
      if (!id) return

      setOptimisticMessages((prev) =>
        prev
          ? prev.map((message) =>
              message.id === messageId ? { ...message, rating } : message
            )
          : prev
      )
      queryClient.setQueryData(
        threadQueryKeys.detail(id),
        (prev: ThreadDetail | undefined) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((message) =>
                  message.id === messageId ? { ...message, rating } : message
                ),
              }
            : prev
      )

      void rateCoachMessage(id, messageId, rating).catch(() => {
        // Keep the optimistic pressed state; a later hydrate is truthful.
      })
    },
    [queryClient, threadId]
  )

  const undo = useCallback(
    async (messageId: string, toolCallId: string) => {
      const id = threadId
      if (!id || phase !== "idle") return

      const result = await reverseCoachReceipt(id, messageId, toolCallId)
      writeDetail(id, result.thread)
      setOptimisticMessages(null)
      void queryClient.invalidateQueries({ queryKey: paperQueryKeys.all })
    },
    [phase, queryClient, threadId, writeDetail]
  )

  return {
    messages,
    phase,
    error: actionError,
    send,
    stop,
    retry,
    regenerate,
    rate,
    undo,
  }
}
