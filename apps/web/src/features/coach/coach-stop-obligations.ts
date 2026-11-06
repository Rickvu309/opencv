import type { QueryClient } from "@tanstack/react-query"
import { parseChatId, type CoachStartInput } from "@workspace/domain"
import { startCoachTask } from "@/lib/coach-task-client.ts"
import { runContractCommand } from "@/lib/contract-client.ts"

export type CoachStopTarget =
  | { kind: "task"; chatId: string; taskId: string }
  | {
      kind: "start"
      startKey: string
      input: Omit<CoachStartInput, "startKey">
      pending: Promise<{ taskId: string }> | null
    }
export type CoachStopResult =
  | { ok: true; taskId: string }
  | { ok: false; taskId: string | null; error: unknown }
type StopTransport = {
  start: (
    input: Omit<CoachStartInput, "startKey">,
    startKey: string
  ) => Promise<{ taskId: string }>
  stop: (chatId: string, taskId: string) => Promise<unknown>
  retryDelay: () => Promise<void>
}
type StopFailure = (taskId: string | null, error: unknown) => void
const obligations = new Map<string, Promise<CoachStopResult>>()

export function fulfillCoachStop(
  target: CoachStopTarget,
  transport: StopTransport,
  onFailure: StopFailure = () => undefined
): Promise<CoachStopResult> {
  const key =
    target.kind === "task"
      ? `task:${target.chatId}:${target.taskId}`
      : `start:${target.input.chatId}:${target.startKey}`
  const existing = obligations.get(key)
  if (existing) return existing
  const run = async (): Promise<CoachStopResult> => {
    let taskId = target.kind === "task" ? target.taskId : null
    let error: unknown
    if (target.kind === "start") {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const started = await (attempt === 0 && target.pending
            ? target.pending
            : transport.start(target.input, target.startKey))
          taskId = started.taskId
          break
        } catch (failure) {
          error = failure
          if (attempt < 2) await transport.retryDelay()
        }
      }
    }
    if (!taskId) {
      onFailure(null, error)
      return { ok: false, taskId: null, error }
    }
    const chatId = target.kind === "task" ? target.chatId : target.input.chatId
    if (target.kind === "start") {
      const taskKey = `task:${chatId}:${taskId}`
      const active = obligations.get(taskKey)
      if (active) return active
      obligations.set(taskKey, pending)
      ownedEntries.push(taskKey)
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await transport.stop(chatId, taskId)
        return { ok: true, taskId }
      } catch (failure) {
        error = failure
        onFailure(taskId, failure)
        if (attempt < 2) await transport.retryDelay()
      }
    }
    return { ok: false, taskId, error }
  }
  const ownedEntries = [key]
  const pending = run().finally(() => {
    for (const ownedKey of ownedEntries) obligations.delete(ownedKey)
  })
  obligations.set(key, pending)
  return pending
}

export function requestCoachStop(
  queryClient: QueryClient,
  target: CoachStopTarget,
  onFailure: StopFailure
) {
  return fulfillCoachStop(
    target,
    {
      start: (input, startKey) => startCoachTask(queryClient, input, startKey),
      stop: (chatId, taskId) =>
        runContractCommand(queryClient, "coach.stop", {
          chatId: parseChatId(chatId),
          taskId,
        }),
      retryDelay: () =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            clearTimeout(timer)
            resolve()
          }, 300)
        }),
    },
    onFailure
  )
}
