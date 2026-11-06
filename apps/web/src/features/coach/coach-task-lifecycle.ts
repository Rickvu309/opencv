import type { CoachStartInput } from "@workspace/domain"
import { taskIsTerminal, type CoachTaskState } from "@/lib/coach-task-state.ts"
import type { CoachSendOptions } from "./use-coach-turn.ts"

type StartRequest = {
  text: string
  sendOptions: CoachSendOptions
  regenerate: boolean
  startKey: string
}
type Delivery =
  | { kind: "unsent" }
  | { kind: "sent" | "lost"; input: Omit<CoachStartInput, "startKey"> }
type Context = {
  generation: number
  chatId: string | null
  task: CoachTaskState | null
  error: string | null
  failedStop: { taskId: string; chatId: string } | null
}
export type CoachTaskLifecycle = Context &
  (
    | { kind: "idle" }
    | {
        kind: "starting"
        request: StartRequest
        delivery: Delivery
        stopRequested: boolean
      }
    | { kind: "running"; taskId: string; startKey: string | null }
    | { kind: "stopping"; taskId: string }
    | {
        kind: "terminal"
        taskId: string
        state: "succeeded" | "failed" | "cancelled"
      }
  )
export type CoachTaskLifecycleEvent =
  | { type: "send"; request: StartRequest }
  | { type: "detach" }
  | ({ generation: number } & (
      | {
          type: "startSent"
          startKey: string
          input: Omit<CoachStartInput, "startKey">
        }
      | { type: "startAccepted"; startKey: string; taskId: string }
      | { type: "startLost"; startKey: string; error: string }
      | { type: "recovered"; taskId: string; chatId: string }
      | { type: "stopPressed" }
      | { type: "stopSucceeded"; taskId: string }
      | { type: "stopFailed"; taskId: string; error: string }
      | { type: "snapshot"; task: CoachTaskState }
    ))
export const idleCoachTask: CoachTaskLifecycle = {
  kind: "idle",
  generation: 0,
  chatId: null,
  task: null,
  error: null,
  failedStop: null,
}
export function coachTaskLifecycleReducer(
  state: CoachTaskLifecycle,
  event: CoachTaskLifecycleEvent
): CoachTaskLifecycle {
  if (event.type === "detach")
    return { ...idleCoachTask, generation: state.generation + 1 }
  if (event.type === "send") {
    if (state.kind !== "idle" && state.kind !== "terminal") return state
    return {
      ...idleCoachTask,
      generation: state.generation + 1,
      kind: "starting",
      request: event.request,
      delivery: { kind: "unsent" },
      stopRequested: false,
    }
  }
  if (event.generation !== state.generation) return state
  switch (event.type) {
    case "startSent":
      return state.kind === "starting" &&
        state.request.startKey === event.startKey &&
        state.delivery.kind !== "sent"
        ? {
            ...state,
            chatId: event.input.chatId,
            delivery: { kind: "sent", input: event.input },
            error: null,
          }
        : state
    case "startAccepted":
      if (
        state.kind !== "starting" ||
        state.delivery.kind !== "sent" ||
        state.request.startKey !== event.startKey
      )
        return state
      return state.stopRequested
        ? { ...state, kind: "stopping", taskId: event.taskId }
        : {
            ...state,
            kind: "running",
            taskId: event.taskId,
            startKey: event.startKey,
          }
    case "startLost":
      if (
        state.kind !== "starting" ||
        state.request.startKey !== event.startKey
      )
        return state
      return state.delivery.kind === "unsent"
        ? { ...idleCoachTask, generation: state.generation, error: event.error }
        : {
            ...state,
            delivery: { ...state.delivery, kind: "lost" },
            error: event.error,
          }
    case "stopPressed":
      if (state.kind === "starting")
        return state.stopRequested
          ? state
          : state.delivery.kind === "unsent"
            ? {
                ...idleCoachTask,
                generation: state.generation,
                error: "The Coach stopped.",
              }
            : { ...state, stopRequested: true, error: "The Coach stopped." }
      return state.kind === "running" ? { ...state, kind: "stopping" } : state
    case "stopSucceeded":
      return ("taskId" in state && state.taskId === event.taskId) ||
        state.failedStop?.taskId === event.taskId
        ? { ...state, failedStop: null, error: null }
        : state
    case "stopFailed": {
      if (
        (state.kind !== "stopping" &&
          state.kind !== "running" &&
          state.kind !== "terminal") ||
        state.taskId !== event.taskId ||
        !state.chatId
      )
        return state
      const failure = {
        failedStop: { taskId: event.taskId, chatId: state.chatId },
        error: event.error,
      }
      return state.kind === "terminal"
        ? { ...state, ...failure }
        : { ...state, ...failure, kind: "running", startKey: null }
    }
    case "recovered":
      if (state.kind !== "idle" && state.kind !== "terminal") return state
      if (state.kind === "terminal" && state.taskId === event.taskId)
        return state
      return {
        ...idleCoachTask,
        generation: state.generation + 1,
        failedStop: state.failedStop,
        error: state.failedStop ? state.error : null,
        kind: "running",
        taskId: event.taskId,
        startKey: null,
        chatId: event.chatId,
      }
    case "snapshot": {
      if (
        (state.kind !== "running" &&
          state.kind !== "stopping" &&
          state.kind !== "terminal") ||
        state.taskId !== event.task.snapshot.taskId
      )
        return state
      if (
        state.kind === "terminal" &&
        !taskIsTerminal(event.task.snapshot.state)
      )
        return state
      const terminal = event.task.snapshot.state
      return terminal === "succeeded" ||
        terminal === "failed" ||
        terminal === "cancelled"
        ? { ...state, kind: "terminal", state: terminal, task: event.task }
        : { ...state, task: event.task }
    }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}
