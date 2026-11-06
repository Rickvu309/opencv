import { coachConfigKey, getCoachConfig } from "@/lib/coach-task-client.ts"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useReducer, useRef } from "react"
import {
  appendCoachPart,
  parsePaperId,
  parseChatId,
  type CoachContextItem,
  textFromParts,
  type CoachSelection,
  type ChatEntryPart,
} from "@workspace/domain"

import { coachSendErrorMessage } from "@/features/coach/coach-error.ts"
import { useCoachMode } from "@/features/coach/use-coach-mode.ts"
import { undoActivity, runContractCommand } from "@/lib/contract-client.ts"
import { ignoreRejection } from "@/lib/quiet-rejection.ts"
import {
  createChat,
  getChat,
  getChatByFocusDoc,
  streamCoachRegenerate,
  streamCoachTurn,
  chatDetailKey,
  type CoachStreamHandlers,
} from "@/features/coach/chat-api.ts"
import {
  STREAMING_COACH_ID,
  latestCoachMessageId,
  toChatViewMessages,
  type ChatViewMessage,
  type CoachChatRecord,
  type ChatMessageAttachment,
} from "@/features/coach/chat-messages.ts"
import { isAbortError } from "@/lib/sse.ts"

import { useCoachTask } from "./use-coach-task.ts"

import { useChatCache } from "./chat-cache.ts"
import { coachProgressReducer, coachProgressRows } from "./coach-progress.ts"
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
  context?: CoachContextItem[]
  attachments?: ChatMessageAttachment[]
}

export type UseCoachTurnOptions = {
  chatId: string | null
  setChatId: (id: string) => void
  titleForCreate: (text: string) => string
  focusDocId?: string | null
  onAfterUndo?: () => void
}

type CoachStreamRun = {
  kind: TurnKind
  messages: ChatViewMessage[]
  user: ChatViewMessage | undefined
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
  chatId,
  setChatId,
  titleForCreate,
  focusDocId,
  onAfterUndo,
}: UseCoachTurnOptions) {
  const config = useQuery({
    queryKey: coachConfigKey(),
    queryFn: getCoachConfig,
    staleTime: 0,
  })
  const durableEnabled = config.data?.coachDurable !== false
  const durable = useCoachTask(
    { chatId, setChatId, titleForCreate, focusDocId, onAfterUndo },
    durableEnabled
  )
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(turnReducer, IDLE_TURN)
  const [progressCalls, progressDispatch] = useReducer(coachProgressReducer, [])
  const sendGeneration = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const { mode } = useCoachMode()
  const phase = turnPhase(state)

  const detailQuery = useQuery({
    queryKey: chatDetailKey(chatId ?? ""),
    queryFn: () => getChat(chatId!),
    enabled: !durableEnabled && Boolean(chatId) && phase === "idle",
    staleTime: Infinity,
  })

  const current = useMemo(
    () =>
      state.messages ??
      (detailQuery.data ? toChatViewMessages(detailQuery.data.messages) : []),
    [detailQuery.data, state.messages]
  )
  const baseline = useMemo(
    () => current.filter((message) => message.id !== STREAMING_COACH_ID),
    [current]
  )
  const progress = useMemo(
    () => ({
      active: phase !== "idle",
      rows: coachProgressRows(
        progressCalls,
        current.find((message) => message.id === STREAMING_COACH_ID)?.parts ??
          []
      ),
    }),
    [current, phase, progressCalls]
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

  const { rememberListItem, hydrateChat, keepStreamedCoach } = useChatCache({
    titleForCreate,
    focusDocId,
  })

  const resolveChatId = useCallback(
    async (text: string, generation: number): Promise<string | null> => {
      if (chatId) return chatId

      if (focusDocId) {
        const existing = await getChatByFocusDoc(focusDocId)
        if (generation !== sendGeneration.current) return null
        if (existing) {
          rememberListItem(existing)
          setChatId(existing.id)
          return existing.id
        }
      }

      const created = await createChat(queryClient, {
        title: titleForCreate(text),
        ...(focusDocId ? { focusDocId: parsePaperId(focusDocId) } : {}),
      })
      rememberListItem(created)
      if (generation !== sendGeneration.current) return null
      setChatId(created.id)
      return created.id
    },
    [
      focusDocId,
      queryClient,
      rememberListItem,
      setChatId,
      chatId,
      titleForCreate,
    ]
  )

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sendGeneration.current += 1
    progressDispatch({ type: "cleared" })
    dispatch({ type: "reset" })
  }, [])

  const stop = useCallback(() => {
    const controller = abortRef.current
    if (chatId && controller) {
      void ignoreRejection(
        runContractCommand(queryClient, "coach.stop", {
          chatId: parseChatId(chatId),
        }),
        "stopAfterAbortIsHarmless"
      ).finally(() => controller.abort())
    } else controller?.abort()
  }, [chatId, queryClient])

  const runCoachStream = useCallback(
    async (run: CoachStreamRun) => {
      const { kind, messages: prefix, user, resolveId, stream, makeError } = run
      const generation = ++sendGeneration.current
      const controller = new AbortController()
      abortRef.current = controller
      const stale = () => generation !== sendGeneration.current
      progressDispatch({ type: "cleared" })
      let stepSequence = 0
      dispatch({ type: "start", kind, messages: prefix })

      let parts: ChatEntryPart[] = []
      let painted = prefix
      let ended = false
      let streamError: string | undefined
      let id: string | null = chatId
      const lastUserIndex = prefix.findLastIndex(
        (message) => message.role === "user"
      )
      const targetCoach =
        kind === "regenerate"
          ? prefix.findLast(
              (message, index) =>
                message.role === "coach" && index > lastUserIndex
            )
          : undefined
      const stablePrefix = targetCoach
        ? prefix.filter((message) => message.id !== targetCoach.id)
        : prefix
      const inheritedReceipts =
        targetCoach?.parts?.filter((part) => part.type === "tool") ?? []

      const settled = (chatKey: string) => {
        const detail = queryClient.getQueryData<CoachChatRecord>(
          chatDetailKey(chatKey)
        )
        return detail ? toChatViewMessages(detail.messages) : prefix
      }
      const paint = (next: ChatEntryPart[]) => {
        parts = next
        const replacing =
          kind === "regenerate" && Boolean(textFromParts(parts).trim())
        painted = [
          ...(replacing ? stablePrefix : prefix),
          {
            id: STREAMING_COACH_ID,
            role: "coach",
            text: textFromParts(parts),
            parts: replacing ? [...inheritedReceipts, ...parts] : parts,
          },
        ]
        dispatch({ type: "delta", messages: painted })
      }
      const keepPartial = async (chatKey: string | null) => {
        if (!chatKey) {
          dispatch({ type: "abort", messages: prefix })
          return
        }
        const detail = await hydrateChat(chatKey)
        if (stale()) return
        const hasSavedReply =
          kind === "regenerate"
            ? Boolean(
                detail &&
                latestCoachMessageId(detail.messages) !==
                  latestCoachMessageId(prefix)
              )
            : (detail?.messages.filter((message) => message.role === "coach")
                .length ?? 0) >
              prefix.filter((message) => message.role === "coach").length
        if (
          !hasSavedReply &&
          parts.length > 0 &&
          (kind !== "regenerate" || textFromParts(parts).trim())
        )
          keepStreamedCoach(chatKey, user, parts, targetCoach?.id)
        dispatch({ type: "abort", messages: settled(chatKey) })
      }
      const handlers: CoachStreamHandlers = {
        onStep({ label }) {
          if (!stale())
            progressDispatch({
              type: "step",
              id: `step-${++stepSequence}`,
              label,
            })
        },
        onToolCall({ toolCallId, name }) {
          if (!stale()) progressDispatch({ type: "call", id: toolCallId, name })
        },
        onTextDelta({ text }) {
          if (stale()) return
          paint(appendCoachPart(parts, { type: "text-delta", text }))
        },
        onToolResult(data) {
          if (stale()) return
          paint(appendCoachPart(parts, data))
        },
        onConfirm(data) {
          if (stale()) return
          paint(
            parts.map((part) =>
              part.type === "tool" &&
              part.name === data.command &&
              !part.pendingActionId
                ? {
                    ...part,
                    pendingActionId: data.pendingActionId,
                    approval: "pending" as const,
                  }
                : part
            )
          )
        },
        onMessageEnd() {
          ended = true
        },
        onError({ message }) {
          streamError = coachSendErrorMessage(new Error(message))
        },
      }

      try {
        id = await resolveId(generation)
        if (!id || stale()) return

        await stream(id, handlers, controller.signal)
        if (stale()) return

        if (ended) {
          const detail = await hydrateChat(id)
          if (stale()) return
          const hasSavedReply =
            kind === "regenerate"
              ? Boolean(
                  detail &&
                  latestCoachMessageId(detail.messages) !==
                    latestCoachMessageId(prefix)
                )
              : Boolean(detail)
          if (
            !hasSavedReply &&
            parts.length > 0 &&
            (kind !== "regenerate" || textFromParts(parts).trim())
          )
            keepStreamedCoach(id, user, parts, targetCoach?.id)
          if (!streamError) {
            dispatch({ type: "finish", messages: null })
            return
          }
          const lastUser = [
            ...(queryClient.getQueryData<CoachChatRecord>(chatDetailKey(id))
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

        await hydrateChat(id)
        if (stale()) return
        dispatch({
          type: "fail",
          error: makeError(
            "The connection ended before Coach finished. Try again.",
            false
          ),
          messages: painted,
        })
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
    [hydrateChat, keepStreamedCoach, queryClient, chatId]
  )

  const send = useCallback(
    (text: string, options: boolean | CoachSendOptions = {}) => {
      const retrying =
        typeof options === "boolean" ? options : options.retrying === true
      const selection =
        typeof options === "boolean" ? undefined : options.selection
      const context = typeof options === "boolean" ? undefined : options.context
      const attachments =
        typeof options === "boolean" ? undefined : options.attachments
      const trimmed = text.trim()
      if (!trimmed || phase !== "idle") return false

      const droppedId =
        retrying && sendError?.local ? sendError.userMessageId : null
      const userMessage: ChatViewMessage = {
        id: `local-${crypto.randomUUID()}`,
        role: "user",
        text: trimmed,
        ...(attachments?.length ? { attachments } : {}),
      }

      void runCoachStream({
        kind: "send",
        messages: [
          ...baseline.filter((message) => message.id !== droppedId),
          userMessage,
        ],
        user: userMessage,
        resolveId: (generation) => resolveChatId(trimmed, generation),
        stream: (id, handlers, signal) =>
          streamCoachTurn(
            queryClient,
            id,
            trimmed,
            handlers,
            signal,
            mode,
            focusDocId,
            selection,
            context
          ),
        makeError: (message, local, userMessageId) => ({
          message,
          userMessageId: userMessageId ?? userMessage.id,
          text: trimmed,
          local,
          selection,
          context,
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
      resolveChatId,
      runCoachStream,
      sendError,
    ]
  )

  const regenerate = useCallback(() => {
    if (phase !== "idle") return false
    const id = chatId
    if (!id) return false

    const lastCoach = baseline.findLast((message) => message.role === "coach")
    if (!lastCoach && !baseline.some((message) => message.role === "user"))
      return false
    const lastUser = baseline.findLast((message) => message.role === "user")

    void runCoachStream({
      kind: "regenerate",
      messages: baseline,
      user: lastUser,
      resolveId: async () => id,
      stream: (chatKey, handlers, signal) =>
        streamCoachRegenerate(
          queryClient,
          chatKey,
          handlers,
          signal,
          mode,
          focusDocId,
          sendError?.selection,
          sendError?.context
        ),
      makeError: (message, local) => ({
        message,
        userMessageId: lastUser?.id ?? "",
        text: "",
        local,
        selection: sendError?.selection,
        context: sendError?.context,
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
    chatId,
    sendError,
  ])

  const retry = useCallback(() => {
    if (!failure) return false
    if (failure.kind === "regenerate" || !failure.error.local)
      return regenerate()
    return send(failure.error.text, {
      retrying: true,
      selection: failure.error.selection,
      context: failure.error.context,
    })
  }, [failure, regenerate, send])

  const undo = useCallback(
    async (activityId: string) => {
      const id = chatId
      if (!id || phase !== "idle") return

      await undoActivity(queryClient, activityId)
      await hydrateChat(id)
      dispatch({ type: "reset" })
      onAfterUndo?.()
    },
    [hydrateChat, onAfterUndo, phase, queryClient, chatId]
  )

  return durableEnabled
    ? {
        ...durable,
        send: config.isSuccess ? durable.send : () => false,
        regenerate: config.isSuccess ? durable.regenerate : () => false,
        error: config.isError
          ? "Could not load Coach settings. Reload to try again."
          : durable.error,
      }
    : {
        messages,
        phase,
        progress,
        error: actionError,
        send,
        stop,
        retry,
        regenerate,
        undo,
        cancelInFlight,
      }
}
