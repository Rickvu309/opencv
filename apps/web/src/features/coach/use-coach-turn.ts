import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useReducer, useRef } from "react"
import {
  appendCoachPart,
  parsePaperId,
  textFromParts,
  type CoachSelection,
  type ThreadDetail,
  type ThreadMessagePart,
} from "@workspace/domain"

import { coachSendErrorMessage } from "@/features/home/coach-error.ts"
import { useCoachMode } from "@/features/home/use-coach-mode.ts"
import { undoActivity } from "@/lib/contract-client.ts"
import {
  createThread,
  getThread,
  getThreadByFocusDoc,
  streamCoachRegenerate,
  streamCoachTurn,
  chatDetailKey,
  type CoachStreamHandlers,
} from "@/features/home/thread-api.ts"
import {
  STREAMING_COACH_ID,
  toHomeMessages,
  type HomeMessage,
} from "@/features/home/threads.ts"
import { isAbortError } from "@/lib/sse.ts"

import { useThreadCache } from "./thread-cache.ts"
import {
  IDLE_TURN,
  turnPhase,
  turnReducer,
  type SendError,
  type TurnKind,
} from "./turn-state.ts"

export type CoachSendOptions = {
  retrying?: boolean
  selection?: CoachSelection
}

export type UseCoachTurnOptions = {
  threadId: string | null
  setThreadId: (id: string) => void
  titleForCreate: (text: string) => string
  focusDocId?: string | null
  onAfterUndo?: () => void
}

type CoachStreamRun = {
  kind: TurnKind
  messages: HomeMessage[]
  user: HomeMessage | undefined
  resolveId: (generation: number) => Promise<string | null>
  stream: (
    id: string,
    handlers: CoachStreamHandlers,
    signal: AbortSignal
  ) => Promise<void>
  makeError: (
    message: string,
    local: boolean,
    userMessageId?: string
  ) => SendError
}

export function useCoachTurn({
  threadId,
  setThreadId,
  titleForCreate,
  focusDocId,
  onAfterUndo,
}: UseCoachTurnOptions) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(turnReducer, IDLE_TURN)
  const sendGeneration = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const { mode } = useCoachMode()
  const phase = turnPhase(state)

  const detailQuery = useQuery({
    queryKey: chatDetailKey(threadId ?? ""),
    queryFn: () => getThread(threadId!),
    enabled: Boolean(threadId) && phase === "idle",
    staleTime: Infinity,
  })

  const current = useMemo(
    () =>
      state.messages ??
      (detailQuery.data ? toHomeMessages(detailQuery.data.messages) : []),
    [detailQuery.data, state.messages]
  )
  const baseline = useMemo(
    () => current.filter((message) => message.id !== STREAMING_COACH_ID),
    [current]
  )
  const failure = state.status === "error" ? state : null
  const sendError = failure?.kind === "send" ? failure.error : null

  const messages = useMemo(() => {
    if (!sendError) return current
    return current.map((message) =>
      message.id === sendError.userMessageId
        ? { ...message, failed: true, error: sendError.message }
        : message
    )
  }, [current, sendError])

  const actionError =
    failure?.kind === "regenerate" ? failure.error.message : null

  const { rememberListItem, hydrateThread, keepStreamedCoach } = useThreadCache(
    { titleForCreate, focusDocId }
  )

  const resolveThreadId = useCallback(
    async (text: string, generation: number): Promise<string | null> => {
      if (threadId) return threadId

      if (focusDocId) {
        const existing = await getThreadByFocusDoc(focusDocId)
        if (generation !== sendGeneration.current) return null
        if (existing) {
          rememberListItem(existing)
          setThreadId(existing.id)
          return existing.id
        }
      }

      const created = await createThread(queryClient, {
        title: titleForCreate(text),
        ...(focusDocId ? { focusDocId: parsePaperId(focusDocId) } : {}),
      })
      rememberListItem(created)
      if (generation !== sendGeneration.current) return null
      setThreadId(created.id)
      return created.id
    },
    [
      focusDocId,
      queryClient,
      rememberListItem,
      setThreadId,
      threadId,
      titleForCreate,
    ]
  )

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sendGeneration.current += 1
    dispatch({ type: "reset" })
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const runCoachStream = useCallback(
    async (run: CoachStreamRun) => {
      const { kind, messages: prefix, user, resolveId, stream, makeError } = run
      const generation = ++sendGeneration.current
      const controller = new AbortController()
      abortRef.current = controller
      const stale = () => generation !== sendGeneration.current
      dispatch({ type: "start", kind, messages: prefix })

      let parts: ThreadMessagePart[] = []
      let painted = prefix
      let ended = false
      let streamError: string | undefined
      let id: string | null = threadId

      const settled = (threadKey: string) => {
        const detail = queryClient.getQueryData<ThreadDetail>(
          chatDetailKey(threadKey)
        )
        return detail ? toHomeMessages(detail.messages) : prefix
      }
      const paint = (next: ThreadMessagePart[]) => {
        parts = next
        painted = [
          ...prefix,
          {
            id: STREAMING_COACH_ID,
            role: "coach",
            text: textFromParts(parts),
            parts,
          },
        ]
        dispatch({ type: "delta", messages: painted })
      }
      const keepPartial = async (threadKey: string | null) => {
        if (!threadKey) {
          dispatch({ type: "abort", messages: prefix })
          return
        }
        await hydrateThread(threadKey)
        if (stale()) return
        if (parts.length > 0) keepStreamedCoach(threadKey, user, parts)
        dispatch({ type: "abort", messages: settled(threadKey) })
      }
      const handlers: CoachStreamHandlers = {
        onTextDelta({ text }) {
          if (stale()) return
          paint(appendCoachPart(parts, { type: "text-delta", text }))
        },
        onToolResult(data) {
          if (stale()) return
          paint(appendCoachPart(parts, data))
        },
        onMessageEnd() {
          ended = true
        },
        onError({ message }) {
          streamError = message
        },
      }

      try {
        id = await resolveId(generation)
        if (!id || stale()) return

        await stream(id, handlers, controller.signal)
        if (stale()) return

        if (ended) {
          const detail = await hydrateThread(id)
          if (stale()) return
          if (!detail && parts.length > 0) keepStreamedCoach(id, user, parts)
          if (!streamError) {
            dispatch({ type: "finish", messages: null })
            return
          }
          const lastUser = [
            ...(queryClient.getQueryData<ThreadDetail>(chatDetailKey(id))
              ?.messages ?? []),
          ]
            .reverse()
            .find((message) => message.role === "user")
          dispatch({
            type: "fail",
            error: makeError(streamError, false, lastUser?.id),
            messages: settled(id),
          })
          return
        }

        if (controller.signal.aborted) {
          await keepPartial(id)
          return
        }

        if (streamError) {
          dispatch({
            type: "fail",
            error: makeError(streamError, false),
            messages: kind === "send" ? painted : prefix,
          })
          return
        }

        await hydrateThread(id)
        if (stale()) return
        dispatch({ type: "finish", messages: null })
      } catch (error) {
        if (stale()) return
        if (isAbortError(error) || controller.signal.aborted) {
          await keepPartial(id)
          return
        }
        dispatch({
          type: "fail",
          error: makeError(coachSendErrorMessage(error), true),
          messages: kind === "send" ? painted : prefix,
        })
      } finally {
        if (!stale()) abortRef.current = null
      }
    },
    [hydrateThread, keepStreamedCoach, queryClient, threadId]
  )

  const send = useCallback(
    (text: string, options: boolean | CoachSendOptions = {}) => {
      const retrying =
        typeof options === "boolean" ? options : options.retrying === true
      const selection =
        typeof options === "boolean" ? undefined : options.selection
      const trimmed = text.trim()
      if (!trimmed || phase !== "idle") return false

      const droppedId =
        retrying && sendError?.local ? sendError.userMessageId : null
      const userMessage: HomeMessage = {
        id: `local-${crypto.randomUUID()}`,
        role: "user",
        text: trimmed,
      }

      void runCoachStream({
        kind: "send",
        messages: [
          ...baseline.filter((message) => message.id !== droppedId),
          userMessage,
        ],
        user: userMessage,
        resolveId: (generation) => resolveThreadId(trimmed, generation),
        stream: (id, handlers, signal) =>
          streamCoachTurn(
            queryClient,
            id,
            trimmed,
            handlers,
            signal,
            mode,
            focusDocId,
            selection
          ),
        makeError: (message, local, userMessageId) => ({
          message,
          userMessageId: userMessageId ?? userMessage.id,
          text: trimmed,
          local,
          selection,
        }),
      })
      return true
    },
    [
      baseline,
      focusDocId,
      mode,
      phase,
      queryClient,
      resolveThreadId,
      runCoachStream,
      sendError,
    ]
  )

  const regenerate = useCallback(() => {
    if (phase !== "idle") return false
    const id = threadId
    if (!id) return false

    const lastCoach = baseline.findLast((message) => message.role === "coach")
    if (!lastCoach) return false
    const lastUser = baseline.findLast((message) => message.role === "user")

    void runCoachStream({
      kind: "regenerate",
      messages: baseline,
      user: lastUser,
      resolveId: async () => id,
      stream: (threadKey, handlers, signal) =>
        streamCoachRegenerate(
          queryClient,
          threadKey,
          handlers,
          signal,
          mode,
          focusDocId
        ),
      makeError: (message, local) => ({
        message,
        userMessageId: lastUser?.id ?? "",
        text: "",
        local,
      }),
    })
    return true
  }, [
    baseline,
    focusDocId,
    mode,
    phase,
    queryClient,
    runCoachStream,
    threadId,
  ])

  const retry = useCallback(() => {
    if (!failure) return false
    if (failure.kind === "regenerate") return regenerate()
    return send(failure.error.text, {
      retrying: true,
      selection: failure.error.selection,
    })
  }, [failure, regenerate, send])

  const undo = useCallback(
    async (activityId: string) => {
      const id = threadId
      if (!id || phase !== "idle") return

      await undoActivity(queryClient, activityId)
      await hydrateThread(id)
      dispatch({ type: "reset" })
      onAfterUndo?.()
    },
    [hydrateThread, onAfterUndo, phase, queryClient, threadId]
  )

  return {
    messages,
    phase,
    error: actionError,
    send,
    stop,
    retry,
    regenerate,
    undo,
    cancelInFlight,
  }
}
