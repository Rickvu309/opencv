import type { QueryClient } from "@tanstack/react-query"
import {
  coachConfigSchema,
  coachTaskEventSchema,
  coachTaskReplaySchema,
  coachTaskSnapshotSchema,
  chatToolNameSchema,
  type CoachStartInput,
} from "@workspace/domain"

import { completeCoachStop } from "@/lib/coach-stop-registry.ts"
import { apiRequest, apiFetch } from "@/lib/api.ts"
import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { catalogClient, refreshReads } from "@/lib/contract-client.ts"
import { endpoints } from "@/lib/requests.ts"
import { createToolRefresher } from "@/lib/coach-stream.ts"
import { readSseStream } from "@/lib/sse.ts"
import {
  coachTaskReducer,
  taskFromSnapshot,
  taskIsTerminal,
  type CoachTaskState,
  type TaskSnapshot,
} from "@/lib/coach-task-state.ts"

export const coachConfigKey = () => ["coach-config"] as const

export async function getCoachConfig({
  signal,
}: { signal?: AbortSignal } = {}) {
  const controller = new AbortController()
  const cancel = () => controller.abort(signal?.reason)
  signal?.addEventListener("abort", cancel, { once: true })
  if (signal?.aborted) cancel()
  const timer = setTimeout(
    () => controller.abort(new Error("Coach settings timed out")),
    5000
  )
  try {
    const response = await apiRequest(endpoints.publicConfig, {
      cache: "no-store",
      signal: controller.signal,
    })
    return coachConfigSchema.parse(await response.json())
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", cancel)
  }
}

export async function startCoachTask(
  queryClient: QueryClient,
  input: Omit<CoachStartInput, "startKey">,
  startKey: string = crypto.randomUUID(),
  signal?: AbortSignal
) {
  const started = await catalogClient.run(
    queryClient,
    "coach.start",
    {
      ...input,
      startKey,
    },
    { signal }
  )
  if ("pending" in started) throw new Error("Coach did not start")
  return started
}

async function getSnapshot(taskId: string, signal: AbortSignal) {
  const body = await apiFetch<SuccessBody<unknown>>(
    endpoints.coachTask(taskId),
    { signal }
  )
  return coachTaskSnapshotSchema.parse(unwrapData(body))
}

function retryAfterDisconnect(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener("abort", done)
      resolve()
    }
    const timer = setTimeout(done, 1000)
    signal.addEventListener("abort", done, { once: true })
    if (signal.aborted) done()
  })
}

export async function tailCoachTask(input: {
  queryClient: QueryClient
  taskId: string
  signal: AbortSignal
  onState: (state: CoachTaskState) => void
}) {
  let state: CoachTaskState | undefined
  const refreshed = new Set<string>()
  const refresh = createToolRefresher(input.queryClient)
  const ingest = (snapshot: TaskSnapshot) => {
    state = state
      ? coachTaskReducer(state, { type: "snapshot", snapshot })
      : taskFromSnapshot(snapshot)
    for (const action of state.snapshot.actions) {
      const key = `${action.step}:${action.slot}:${action.state}`
      if (refreshed.has(key) || action.state !== "committed") continue
      refreshed.add(key)
      const name = chatToolNameSchema.parse(action.operation)
      refresh({
        type: "tool-call",
        toolCallId: action.toolCallId,
        name,
        input: action.input,
      })
      refresh({
        type: "tool-result",
        toolCallId: action.toolCallId,
        name,
        summary: name,
        ok: true,
        result: { ok: true, data: action.result },
      })
    }
    if (taskIsTerminal(state.snapshot.state))
      completeCoachStop(state.snapshot.chatId, state.snapshot.taskId)
    input.onState(state)
  }
  while (!input.signal.aborted) {
    try {
      ingest(await getSnapshot(input.taskId, input.signal))
      if (!state || taskIsTerminal(state.snapshot.state)) break
      const response = await apiRequest(
        endpoints.coachTaskEvents(input.taskId, state.cursor),
        { signal: input.signal }
      )
      if (!response.body) throw new Error("Coach stream was empty")
      for await (const wire of readSseStream(response.body, {
        signal: input.signal,
      })) {
        if (wire.event === "reset") {
          const reset = coachTaskReplaySchema.parse(wire.data)
          if (reset.type === "reset") ingest(reset.snapshot)
        } else if (wire.event === "task") {
          state = coachTaskReducer(state, {
            type: "event",
            event: coachTaskEventSchema.parse(wire.data),
          })
          if (state.needsSnapshot)
            ingest(await getSnapshot(input.taskId, input.signal))
          else {
            if (taskIsTerminal(state.snapshot.state))
              completeCoachStop(state.snapshot.chatId, state.snapshot.taskId)
            input.onState(state)
          }
        } else if (wire.event === "error")
          throw new Error("Coach stream disconnected")
        if (taskIsTerminal(state.snapshot.state)) break
      }
      if (taskIsTerminal(state.snapshot.state)) break
    } catch {
      if (input.signal.aborted) return
    }
    if (state) {
      state = coachTaskReducer(state, { type: "disconnected" })
      if (taskIsTerminal(state.snapshot.state))
        completeCoachStop(state.snapshot.chatId, state.snapshot.taskId)
      input.onState(state)
    }
    await retryAfterDisconnect(input.signal)
  }
  if (!input.signal.aborted && state)
    await refreshReads(input.queryClient, [
      { query: "chat.get", input: { chatId: state.snapshot.chatId } },
      { query: "chat.list" },
      { query: "coach.usage" },
    ])
}

type Subscription = {
  controller: AbortController
  listeners: Set<(state: CoachTaskState) => void>
  state?: CoachTaskState
}
const subscriptions = new WeakMap<QueryClient, Map<string, Subscription>>()

export function subscribeCoachTask(
  queryClient: QueryClient,
  taskId: string,
  listener: (state: CoachTaskState) => void
) {
  let tasks = subscriptions.get(queryClient)
  if (!tasks) {
    tasks = new Map()
    subscriptions.set(queryClient, tasks)
  }
  let subscription = tasks.get(taskId)
  if (!subscription) {
    subscription = { controller: new AbortController(), listeners: new Set() }
    tasks.set(taskId, subscription)
    const current = subscription
    void tailCoachTask({
      queryClient,
      taskId,
      signal: current.controller.signal,
      onState(state) {
        current.state = state
        for (const notify of current.listeners) notify(state)
      },
    })
  }
  subscription.listeners.add(listener)
  if (subscription.state) listener(subscription.state)
  const current = subscription
  return () => {
    current.listeners.delete(listener)
    if (!current.listeners.size) {
      current.controller.abort()
      tasks.delete(taskId)
    }
  }
}
