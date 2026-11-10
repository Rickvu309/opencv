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
import { observeCoachStop } from "@/lib/coach-stop-registry.ts"
import { startCoachTask, subscribeCoachTask } from "@/lib/coach-task-client.ts"
import { taskIsTerminal, taskParts } from "@/lib/coach-task-state.ts"
import { undoActivity } from "@/lib/contract-client.ts"
import {
  requestCoachStop,
  type CoachStopTarget,
} from "./coach-stop-obligations.ts"
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
  const inFlightStart = useRef<{
    startKey: string
    controller: AbortController
    pending: Promise<{ taskId: string }>
  } | null>(null)
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
  }, [enabled, discoveredTaskId, options.chatId, local.kind])
  const taskId = "taskId" in local ? local.taskId : null
  const task = local.chatId === options.chatId ? local.task : null
  useEffect(() => {
    if (!enabled || !taskId) return
    const generation = machine.current.generation
    return subscribeCoachTask(queryClient, taskId, (task) =>
      transition({ type: "snapshot", generation, task })
    )
  }, [enabled, queryClient, taskId, local.generation])
  useEffect(() => {
    if (!enabled || !taskId || !local.chatId) return
    const generation = local.generation
    return observeCoachStop(local.chatId, taskId, (taskId, error) => {
      if (taskId)
        transition({
          type: "stopFailed",
          generation,
          taskId,
          error: coachSendErrorMessage(error),
        })
    })
  }, [enabled, taskId, local.chatId, local.generation])
  const active =
    local.kind === "running" ||
    local.kind === "stopping" ||
    (local.kind === "starting" &&
      (local.delivery.kind !== "lost" ||
        local.stopRequested ||
        Boolean(discoveredTaskId)))
  const parts = task ? taskParts(task) : []
  const canonical = task?.snapshot.messages
    .filter((message) => message.id !== task.snapshot.taskId)
    .map((message) => ({
      ...message,
      role: message.role === "person" ? ("user" as const) : ("coach" as const),
      workedMs: message.workedMs ?? undefined,
      status: message.status ?? undefined,
      parts: message.parts.filter(
        (part) => part.type === "text" || part.type === "tool"
      ),
      attachments: detail.data?.messages.find(
        (saved) => saved.id === message.id
      )?.attachments,
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
  const stop = (retryFailed = false) => {
    const previous = machine.current
    const failedStop = retryFailed ? previous.failedStop : null
    if (previous.kind === "stopping" && !failedStop) return true
    const target: CoachStopTarget | null = failedStop
      ? { kind: "task", ...failedStop }
      : (previous.kind === "running" || previous.kind === "stopping") &&
          previous.chatId
        ? { kind: "task", chatId: previous.chatId, taskId: previous.taskId }
        : previous.kind === "starting" && previous.delivery.kind !== "unsent"
          ? {
              kind: "start",
              startKey: previous.request.startKey,
              input: previous.delivery.input,
              pending:
                inFlightStart.current?.startKey === previous.request.startKey
                  ? inFlightStart.current.pending
                  : null,
              controller:
                inFlightStart.current?.startKey === previous.request.startKey
                  ? inFlightStart.current.controller
                  : undefined,
            }
          : null
    const generation = previous.generation
    if (
      !failedStop ||
      ("taskId" in previous && previous.taskId === failedStop.taskId)
    )
      transition({ type: "stopPressed", generation })
    if (!target) return false
    if (previous.kind === "starting" && previous.delivery.kind === "lost")
      transition({
        type: "startSent",
        generation,
        startKey: previous.request.startKey,
        input: previous.delivery.input,
      })
    const accept = (taskId: string) => {
      if (target.kind === "start") {
        transition({
          type: "startSent",
          generation,
          startKey: target.startKey,
          input: target.input,
        })
        transition({
          type: "startAccepted",
          generation,
          startKey: target.startKey,
          taskId,
        })
      }
    }
    void requestCoachStop(queryClient, target, (taskId, error) => {
      if (taskId) {
        accept(taskId)
        transition({
          type: "stopFailed",
          generation,
          taskId,
          error: coachSendErrorMessage(error),
        })
      }
    }).then((result) => {
      if (result.taskId) accept(result.taskId)
      if (result.ok)
        transition({ type: "stopSucceeded", generation, taskId: result.taskId })
      else if (!result.taskId && target.kind === "start")
        transition({
          type: "startLost",
          generation,
          startKey: target.startKey,
          error: coachSendErrorMessage(result.error),
        })
    })
    return true
  }
  const executeStart = async (generation: number, startKey: string) => {
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
      const controller = new AbortController()
      const pending = startCoachTask(
        queryClient,
        input,
        startKey,
        controller.signal
      )
      inFlightStart.current = { startKey, pending, controller }
      const started = await pending
      if (inFlightStart.current?.pending === pending)
        inFlightStart.current = null
      if (!matches()) return
      transition({
        type: "startAccepted",
        generation,
        startKey,
        taskId: started.taskId,
      })
    } catch (error) {
      const state = matches()
      if (!state) return
      transition({
        type: "startLost",
        generation,
        startKey,
        error: coachSendErrorMessage(error),
      })
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
    recovering: enabled && Boolean(options.chatId) && detail.isPending,
    hasActiveTask:
      active ||
      Boolean(
        discoveredTaskId &&
        (!task ||
          task.snapshot.taskId !== discoveredTaskId ||
          !taskIsTerminal(task.snapshot.state))
      ),
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
    limitReached: task?.snapshot.errorCode === "BUDGET_EXCEEDED",
    error:
      local.error ??
      (task?.snapshot.errorCode === "BUDGET_EXCEEDED"
        ? "The Coach hit its limit for this turn."
        : task?.snapshot.state === "failed"
          ? "The Coach stopped. Try again."
          : task?.snapshot.state === "cancelled"
            ? "The Coach stopped."
            : null),
    send: (text: string, sendOptions: boolean | CoachSendOptions = {}) =>
      launch(text, typeof sendOptions === "boolean" ? {} : sendOptions),
    retry: () => {
      if (task?.snapshot.errorCode === "BUDGET_EXCEEDED") return false
      const state = machine.current
      if (
        state.failedStop ||
        (state.kind === "starting" && state.stopRequested)
      )
        return stop(true)
      if (state.kind === "starting" && state.delivery.kind === "lost") {
        transition({
          type: "startSent",
          generation: state.generation,
          startKey: state.request.startKey,
          input: state.delivery.input,
        })
        void executeStart(state.generation, state.request.startKey)
        return true
      }
      return Boolean(options.chatId) && launch("", {}, true)
    },
    regenerate: () => Boolean(options.chatId) && launch("", {}, true),
    stop: () => stop(),
    undo: async (activityId: string) => {
      await undoActivity(queryClient, activityId)
      options.onAfterUndo?.()
    },
    cancelInFlight: () => {
      transition({ type: "detach" })
    },
  }
}
