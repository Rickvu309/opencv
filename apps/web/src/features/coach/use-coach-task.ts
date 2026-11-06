import { useEffect, useReducer, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  parseChatId,
  parsePaperId,
  textFromParts,
  chatToolNameSchema,
  type CoachStartInput,
} from "@workspace/domain"

import {
  createChat,
  getChat,
  getChatByFocusDoc,
  chatDetailKey,
} from "./chat-api.ts"
import { STREAMING_COACH_ID, toChatViewMessages } from "./chat-messages.ts"
import { coachProgressRows } from "./coach-progress.ts"
import type { UseCoachTurnOptions, CoachSendOptions } from "./use-coach-turn.ts"
import { coachSendErrorMessage } from "./coach-error.ts"
import { startCoachTask, subscribeCoachTask } from "@/lib/coach-task-client.ts"
import {
  taskIsTerminal,
  taskParts,
  type CoachTaskState,
} from "@/lib/coach-task-state.ts"
import { runContractCommand, undoActivity } from "@/lib/contract-client.ts"
import { useCoachMode } from "./use-coach-mode.ts"

type LocalState = {
  task: CoachTaskState | null
  taskId: string | null
  starting: boolean
  error: string | null
  chatId: string | null
}
type PendingStart = {
  text: string
  sendOptions: CoachSendOptions
  regenerate: boolean
  startKey: string
  chatId?: string
  input?: Omit<CoachStartInput, "startKey">
}
const empty: LocalState = {
  task: null,
  taskId: null,
  starting: false,
  error: null,
  chatId: null,
}

export function useCoachTask(options: UseCoachTurnOptions, enabled: boolean) {
  const queryClient = useQueryClient()
  const { mode } = useCoachMode()
  const [local, update] = useReducer(
    (state: LocalState, patch: Partial<LocalState>) => ({ ...state, ...patch }),
    empty
  )
  const starting = useRef(false)
  const generation = useRef(0)
  const pendingStart = useRef<PendingStart | null>(null)
  const detail = useQuery({
    queryKey: chatDetailKey(options.chatId ?? ""),
    queryFn: () => getChat(options.chatId!),
    enabled: enabled && Boolean(options.chatId),
    refetchInterval: enabled ? 1500 : false,
  })
  const localTaskId = local.chatId === options.chatId ? local.taskId : null
  const taskId =
    local.task && taskIsTerminal(local.task.snapshot.state)
      ? (detail.data?.activeTaskId ?? localTaskId)
      : (localTaskId ?? detail.data?.activeTaskId)
  const task =
    local.chatId === options.chatId && local.task?.snapshot.taskId === taskId
      ? local.task
      : null
  useEffect(() => {
    if (!enabled || !taskId) return
    return subscribeCoachTask(queryClient, taskId, (task) =>
      update({ task, taskId, chatId: task.snapshot.chatId })
    )
  }, [enabled, queryClient, taskId])
  const active =
    local.starting ||
    Boolean(taskId && (!task || !taskIsTerminal(task.snapshot.state)))
  const parts = task ? taskParts(task) : []
  const canonical = task?.snapshot.messages.map((message) => ({
    ...message,
    role: message.role === "person" ? ("user" as const) : ("coach" as const),
    workedMs: message.workedMs ?? undefined,
    status: message.status ?? undefined,
    parts: message.parts.filter(
      (part) => part.type === "text" || part.type === "tool"
    ),
    attachments: detail.data?.messages.find((saved) => saved.id === message.id)
      ?.attachments,
  }))
  const terminalSaved =
    task?.snapshot.assistantMessageId &&
    detail.data?.messages.some(
      (message) => message.id === task.snapshot.assistantMessageId
    )
  const saved =
    task && (!taskIsTerminal(task.snapshot.state) || !terminalSaved)
      ? (canonical ?? [])
      : (detail.data?.messages ?? [])
  const messages = toChatViewMessages(saved)
  if (task && !taskIsTerminal(task.snapshot.state))
    messages.push({
      id: STREAMING_COACH_ID,
      role: "coach",
      text: textFromParts(parts),
      parts,
    })
  const launch = (
    text: string,
    sendOptions: CoachSendOptions = {},
    regenerate = false,
    retry?: PendingStart
  ) => {
    if (!enabled || active || starting.current || (!regenerate && !text.trim()))
      return false
    starting.current = true
    const request: PendingStart = retry ?? {
      text,
      sendOptions,
      regenerate,
      startKey: crypto.randomUUID(),
    }
    pendingStart.current = request
    const current = ++generation.current
    update({ starting: true, error: null })
    void (async () => {
      try {
        const id =
          request.chatId ??
          options.chatId ??
          (options.focusDocId
            ? (await getChatByFocusDoc(options.focusDocId))?.id
            : null) ??
          (
            await createChat(queryClient, {
              title: options.titleForCreate(text),
              ...(options.focusDocId
                ? { focusDocId: parsePaperId(options.focusDocId) }
                : {}),
            })
          ).id
        if (current !== generation.current) return
        request.chatId = id
        options.setChatId(id)
        const input: Omit<CoachStartInput, "startKey"> = request.input ?? {
          chatId: parseChatId(id),
          text: regenerate ? undefined : text.trim(),
          regenerate: regenerate ? true : undefined,
          mode,
          focusDocId:
            options.focusDocId == null
              ? options.focusDocId
              : parsePaperId(options.focusDocId),
          selection: sendOptions.selection,
          context: sendOptions.context,
        }
        request.input = input
        const started = await startCoachTask(
          queryClient,
          input,
          request.startKey
        )
        if (current !== generation.current) return
        pendingStart.current = null
        update({ task: null, taskId: started.taskId, chatId: id })
      } catch (error) {
        if (current === generation.current)
          update({ error: coachSendErrorMessage(error) })
      } finally {
        starting.current = false
        if (current === generation.current) update({ starting: false })
      }
    })()
    return true
  }
  return {
    messages,
    phase: active
      ? parts.length
        ? ("streaming" as const)
        : ("waiting" as const)
      : ("idle" as const),
    progress: {
      active,
      rows: [
        ...(task?.reconnecting
          ? [
              {
                id: "reconnecting",
                label: "Reconnecting…",
                status: "reported" as const,
              },
            ]
          : []),
        ...coachProgressRows(
          task?.snapshot.actions.map((action) => ({
            kind: "call" as const,
            id: action.toolCallId,
            label: action.operation,
            name: chatToolNameSchema.parse(action.operation),
          })) ?? [],
          parts
        ),
      ],
    },
    error:
      local.error ??
      (task?.snapshot.state === "failed"
        ? "The Coach stopped. Try again."
        : null),
    send: (text: string, sendOptions: boolean | CoachSendOptions = {}) =>
      launch(text, typeof sendOptions === "boolean" ? {} : sendOptions),
    retry: () => {
      const request = pendingStart.current
      return request
        ? launch(request.text, request.sendOptions, request.regenerate, request)
        : Boolean(options.chatId) && launch("", {}, true)
    },
    regenerate: () => Boolean(options.chatId) && launch("", {}, true),
    stop: () => {
      if (options.chatId)
        void runContractCommand(queryClient, "coach.stop", {
          chatId: parseChatId(options.chatId),
        }).catch((error: unknown) =>
          update({ error: coachSendErrorMessage(error) })
        )
    },
    undo: async (activityId: string) => {
      await undoActivity(queryClient, activityId)
      options.onAfterUndo?.()
    },
    cancelInFlight: () => {
      ++generation.current
      pendingStart.current = null
      update(empty)
    },
  }
}
