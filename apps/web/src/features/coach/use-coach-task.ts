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
import { taskIsTerminal, taskParts } from "@/lib/coach-task-state.ts"
import { runContractCommand, undoActivity } from "@/lib/contract-client.ts"
import { useCoachMode } from "./use-coach-mode.ts"

import {
  coachTaskLifecycleReducer,
  idleCoachTask,
  type CoachTaskLifecycleEvent,
} from "./coach-task-lifecycle.ts"

export function useCoachTask(options: UseCoachTurnOptions, enabled: boolean) {
  const queryClient = useQueryClient()
  const { mode } = useCoachMode()
  const [local, dispatch] = useReducer(coachTaskLifecycleReducer, idleCoachTask)
  const machine = useRef(idleCoachTask)
  const transition = (event: CoachTaskLifecycleEvent) => {
    machine.current = coachTaskLifecycleReducer(machine.current, event)
    dispatch(event)
    return machine.current
  }
  useEffect(
    () => () => {
      machine.current = coachTaskLifecycleReducer(machine.current, {
        type: "detach",
      })
      dispatch({ type: "detach" })
    },
    []
  )
  const detail = useQuery({
    queryKey: chatDetailKey(options.chatId ?? ""),
    queryFn: () => getChat(options.chatId!),
    enabled: enabled && Boolean(options.chatId),
    refetchInterval: enabled ? 1500 : false,
  })
  const discoveredTaskId = detail.data?.activeTaskId
  useEffect(() => {
    if (enabled && discoveredTaskId && options.chatId)
      transition({
        type: "recovered",
        generation: machine.current.generation,
        taskId: discoveredTaskId,
        chatId: options.chatId,
      })
  }, [enabled, discoveredTaskId, options.chatId])
  const taskId = "taskId" in local ? local.taskId : null
  const task = local.chatId === options.chatId ? local.task : null
  useEffect(() => {
    if (!enabled || !taskId) return
    const generation = machine.current.generation
    return subscribeCoachTask(queryClient, taskId, (task) =>
      transition({ type: "snapshot", generation, task })
    )
  }, [enabled, queryClient, taskId, local.generation])
  const active =
    local.kind === "running" ||
    local.kind === "stopping" ||
    (local.kind === "starting" &&
      (local.delivery.kind !== "lost" ||
        local.stopRequested ||
        Boolean(discoveredTaskId)))
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
  const stopTask = async (taskId: string, generation: number) => {
    const state = machine.current
    if (
      state.kind !== "stopping" ||
      state.taskId !== taskId ||
      state.generation !== generation ||
      !state.chatId
    )
      return
    try {
      await runContractCommand(queryClient, "coach.stop", {
        chatId: parseChatId(state.chatId),
        taskId,
      })
    } catch (error) {
      transition({
        type: "stopFailed",
        taskId,
        generation,
        error: coachSendErrorMessage(error),
      })
    }
  }
  const executeStart = async (
    generation: number,
    startKey: string,
    recovering = false
  ) => {
    const matches = () => {
      const state = machine.current
      return state.kind === "starting" &&
        state.generation === generation &&
        state.request.startKey === startKey
        ? state
        : null
    }
    await Promise.resolve()
    const initial = matches()
    if (!initial) return
    try {
      const { text, regenerate, sendOptions } = initial.request
      const id =
        initial.chatId ??
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
      const state = matches()
      if (!state) return
      options.setChatId(id)
      const input: Omit<CoachStartInput, "startKey"> =
        state.delivery.kind !== "unsent"
          ? state.delivery.input
          : {
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
      transition({ type: "startSent", generation, startKey, input })
      const started = await startCoachTask(queryClient, input, startKey)
      if (!matches()) return
      const accepted = transition({
        type: "startAccepted",
        generation,
        startKey,
        taskId: started.taskId,
      })
      if (accepted.kind === "stopping")
        await stopTask(accepted.taskId, generation)
    } catch (error) {
      const state = matches()
      if (!state) return
      transition({
        type: "startLost",
        generation,
        startKey,
        error: coachSendErrorMessage(error),
      })
      if (state.stopRequested && state.delivery.kind === "sent" && !recovering)
        void executeStart(generation, startKey, true)
    }
  }
  const launch = (
    text: string,
    sendOptions: CoachSendOptions = {},
    regenerate = false
  ) => {
    if (
      !enabled ||
      (machine.current.kind !== "idle" &&
        machine.current.kind !== "terminal") ||
      (!regenerate && !text.trim())
    )
      return false
    const state = transition({
      type: "send",
      request: { text, sendOptions, regenerate, startKey: crypto.randomUUID() },
    })
    if (state.kind === "starting")
      void executeStart(state.generation, state.request.startKey)
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
        : task?.snapshot.state === "cancelled"
          ? "The Coach stopped."
          : null),
    send: (text: string, sendOptions: boolean | CoachSendOptions = {}) =>
      launch(text, typeof sendOptions === "boolean" ? {} : sendOptions),
    retry: () => {
      const state = machine.current
      if (state.kind === "starting" && state.delivery.kind === "lost") {
        transition({
          type: "startSent",
          generation: state.generation,
          startKey: state.request.startKey,
          input: state.delivery.input,
        })
        void executeStart(state.generation, state.request.startKey, true)
        return true
      }
      return Boolean(options.chatId) && launch("", {}, true)
    },
    regenerate: () => Boolean(options.chatId) && launch("", {}, true),
    stop: () => {
      const previous = machine.current
      const state = transition({
        type: "stopPressed",
        generation: previous.generation,
      })
      if (state.kind === "stopping" && previous.kind === "running")
        void stopTask(state.taskId, state.generation)
      if (state.kind === "starting" && state.delivery.kind === "lost") {
        transition({
          type: "startSent",
          generation: state.generation,
          startKey: state.request.startKey,
          input: state.delivery.input,
        })
        void executeStart(state.generation, state.request.startKey, true)
      }
    },
    undo: async (activityId: string) => {
      await undoActivity(queryClient, activityId)
      options.onAfterUndo?.()
    },
    cancelInFlight: () => {
      transition({ type: "detach" })
    },
  }
}
