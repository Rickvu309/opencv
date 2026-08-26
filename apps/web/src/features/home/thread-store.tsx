import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import {
  appendCoachPart,
  DEFAULT_THREAD_TITLE,
  textFromParts,
  type CoachUsageRating,
  type ThreadDetail,
  type ThreadListItem,
  type ThreadMessage,
  type ThreadMessagePart,
} from "@workspace/domain"

import { applyQueryKeys } from "@/features/apply/apply-api.ts"
import { coachSendErrorMessage } from "@/features/home/coach-error.ts"
import { profileQueryKeys } from "@/features/home/profile-api.ts"
import { useCoachMode } from "@/features/home/use-coach-mode.ts"
import { paperQueryKeys } from "@/features/paper/paper-api.ts"
import {
  createThread,
  getThread,
  listThreads,
  rateCoachMessage,
  reverseCoachReceipt,
  streamCoachRegenerate,
  streamCoachTurn,
  threadQueryKeys,
  toListItem,
  upsertThreadListItem,
} from "@/features/home/thread-api.ts"
import {
  ThreadStoreContext,
  type TurnPhase,
} from "@/features/home/thread-store-context.ts"
import {
  STREAMING_COACH_ID,
  titleFrom,
  toHomeMessages,
  type HomeMessage,
} from "@/features/home/threads.ts"
import { isAbortError } from "@/lib/sse.ts"

const EMPTY_THREADS: ThreadListItem[] = []

type SendError = {
  message: string
  userMessageId: string
  text: string
  local: boolean
}

export function ThreadStoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [optimisticMessages, setOptimisticMessages] = useState<
    HomeMessage[] | null
  >(null)
  const [phase, setPhase] = useState<TurnPhase>("idle")
  const [sendError, setSendError] = useState<SendError | null>(null)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const sendGeneration = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const { mode } = useCoachMode()

  const listQuery = useQuery({
    queryKey: threadQueryKeys.list(),
    queryFn: listThreads,
  })
  const threads = listQuery.data ?? EMPTY_THREADS

  const detailQuery = useQuery({
    queryKey: threadQueryKeys.detail(activeThreadId ?? ""),
    queryFn: () => getThread(activeThreadId!),
    enabled: Boolean(activeThreadId) && phase === "idle",
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

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sendGeneration.current += 1
    setPhase("idle")
    setOptimisticMessages(null)
    setSendError(null)
    setRegenerateError(null)
  }, [])

  const newThread = useCallback(() => {
    cancelInFlight()
    setActiveThreadId(null)
  }, [cancelInFlight])

  const openThread = useCallback(
    (id: string) => {
      cancelInFlight()
      setActiveThreadId(id)
    },
    [cancelInFlight]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const writeDetail = useCallback(
    (threadId: string, detail: ThreadDetail) => {
      queryClient.setQueryData(threadQueryKeys.detail(threadId), detail)
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
      threadId: string,
      fallback?: ThreadMessage
    ): Promise<ThreadDetail | undefined> => {
      try {
        const detail = await getThread(threadId)
        writeDetail(threadId, detail)
        return detail
      } catch {
        if (!fallback) return undefined
        const prev = queryClient.getQueryData<ThreadDetail>(
          threadQueryKeys.detail(threadId)
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
        writeDetail(threadId, next)
        return next
      }
    },
    [queryClient, writeDetail]
  )

  const keepStreamedCoach = useCallback(
    (
      threadId: string,
      user: HomeMessage | undefined,
      parts: ThreadMessagePart[]
    ): void => {
      const now = new Date().toISOString()
      const coachText = textFromParts(parts)
      const prev = queryClient.getQueryData<ThreadDetail>(
        threadQueryKeys.detail(threadId)
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

      const messages = prev?.messages ?? []
      const hasUser = user
        ? messages.some(
            (message) => message.role === "user" && message.text === user.text
          )
        : true
      writeDetail(threadId, {
        id: threadId,
        title: prev?.title ?? (user ? titleFrom(user.text) : DEFAULT_THREAD_TITLE),
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        messages: [
          ...(hasUser || !userRow ? messages : [...messages, userRow]),
          ...(hasText ? [] : [coachRow]),
        ],
      })
    },
    [queryClient, writeDetail]
  )

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
        let threadId = activeThreadId

        try {
          if (!threadId) {
            const created = await createThread({ title: titleFrom(trimmed) })
            queryClient.setQueryData(
              threadQueryKeys.list(),
              (prev: ThreadListItem[] | undefined) =>
                upsertThreadListItem(prev ?? [], created)
            )
            if (generation !== sendGeneration.current) return
            threadId = created.id
            setActiveThreadId(threadId)
          }

          await streamCoachTurn(
            threadId,
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
            mode
          )

          if (generation !== sendGeneration.current) return

          if (ended) {
            await hydrateThread(threadId, ended)
            if (generation !== sendGeneration.current) return
            if (streamError) {
              const detail = queryClient.getQueryData<ThreadDetail>(
                threadQueryKeys.detail(threadId)
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
            await hydrateThread(threadId)
            if (generation !== sendGeneration.current) return
            if (streamedParts.length > 0) {
              keepStreamedCoach(threadId, userMessage, streamedParts)
            }
            const detail = queryClient.getQueryData<ThreadDetail>(
              threadQueryKeys.detail(threadId)
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

          await hydrateThread(threadId)
          if (generation !== sendGeneration.current) return
          setOptimisticMessages(null)
          setPhase("idle")
        } catch (error) {
          if (generation !== sendGeneration.current) return
          if (isAbortError(error) || controller.signal.aborted) {
            if (threadId) {
              await hydrateThread(threadId)
              if (generation !== sendGeneration.current) return
              if (streamedParts.length > 0) {
                keepStreamedCoach(threadId, userMessage, streamedParts)
              }
              const detail = queryClient.getQueryData<ThreadDetail>(
                threadQueryKeys.detail(threadId)
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
      activeThreadId,
      detailQuery.data,
      hydrateThread,
      keepStreamedCoach,
      optimisticMessages,
      phase,
      queryClient,
      sendError,
      mode,
    ]
  )

  const regenerate = useCallback(() => {
    if (phase !== "idle") return false
    const threadId = activeThreadId
    if (!threadId) return false

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
          threadId,
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
          mode
        )

        if (generation !== sendGeneration.current) return

        if (ended) {
          await hydrateThread(threadId, ended)
          if (generation !== sendGeneration.current) return
          if (streamError) {
            setRegenerateError(streamError)
          }
          setOptimisticMessages(null)
          setPhase("idle")
          return
        }

        if (controller.signal.aborted) {
          await hydrateThread(threadId)
          if (generation !== sendGeneration.current) return
          if (streamedParts.length > 0) {
            keepStreamedCoach(threadId, lastUser, streamedParts)
          }
          const detail = queryClient.getQueryData<ThreadDetail>(
            threadQueryKeys.detail(threadId)
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

        await hydrateThread(threadId)
        if (generation !== sendGeneration.current) return
        setOptimisticMessages(null)
        setPhase("idle")
      } catch (error) {
        if (generation !== sendGeneration.current) return
        if (isAbortError(error) || controller.signal.aborted) {
          await hydrateThread(threadId)
          if (generation !== sendGeneration.current) return
          if (streamedParts.length > 0) {
            keepStreamedCoach(threadId, lastUser, streamedParts)
          }
          const detail = queryClient.getQueryData<ThreadDetail>(
            threadQueryKeys.detail(threadId)
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
    activeThreadId,
    detailQuery.data,
    hydrateThread,
    keepStreamedCoach,
    optimisticMessages,
    phase,
    queryClient,
    mode,
  ])

  const retry = useCallback(() => {
    if (phase !== "idle") return false
    if (regenerateError) return regenerate()
    if (!sendError) return false
    return send(sendError.text, true)
  }, [phase, regenerate, regenerateError, send, sendError])

  const rate = useCallback(
    (messageId: string, rating: CoachUsageRating) => {
      const threadId = activeThreadId
      if (!threadId) return

      setOptimisticMessages((prev) =>
        prev
          ? prev.map((message) =>
              message.id === messageId ? { ...message, rating } : message
            )
          : prev
      )
      queryClient.setQueryData(
        threadQueryKeys.detail(threadId),
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

      void rateCoachMessage(threadId, messageId, rating).catch(() => {
        // Keep the optimistic pressed state; a later hydrate is truthful.
      })
    },
    [activeThreadId, queryClient]
  )

  const undo = useCallback(
    async (messageId: string, toolCallId: string) => {
      const threadId = activeThreadId
      if (!threadId || phase !== "idle") return

      const result = await reverseCoachReceipt(threadId, messageId, toolCallId)
      writeDetail(threadId, result.thread)
      setOptimisticMessages(null)
      void queryClient.invalidateQueries({ queryKey: applyQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: paperQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() })
    },
    [activeThreadId, phase, queryClient, writeDetail]
  )

  const value = useMemo(
    () => ({
      threads,
      activeThreadId,
      messages,
      phase,
      error: actionError,
      send,
      stop,
      retry,
      regenerate,
      rate,
      undo,
      openThread,
      newThread,
    }),
    [
      threads,
      activeThreadId,
      messages,
      phase,
      actionError,
      send,
      stop,
      retry,
      regenerate,
      rate,
      undo,
      openThread,
      newThread,
    ]
  )

  return (
    <ThreadStoreContext.Provider value={value}>
      {children}
    </ThreadStoreContext.Provider>
  )
}
