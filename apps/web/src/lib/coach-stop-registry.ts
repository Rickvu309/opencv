import type { CoachStartInput } from "@workspace/domain/coach"

export type CoachStopTarget =
  | { kind: "task"; chatId: string; taskId: string }
  | {
      kind: "start"
      startKey: string
      input: Omit<CoachStartInput, "startKey">
      pending: Promise<{ taskId: string }> | null
      controller?: AbortController
    }
export type CoachStopResult =
  | { ok: true; taskId: string }
  | { ok: false; taskId: string | null; error: unknown }
type StopTransport = {
  start: (
    input: Omit<CoachStartInput, "startKey">,
    startKey: string,
    signal: AbortSignal
  ) => Promise<{ taskId: string }>
  stop: (
    chatId: string,
    taskId: string,
    signal: AbortSignal
  ) => Promise<unknown>
  retryDelay: (attempt: number, signal: AbortSignal) => Promise<void>
}
type StopFailure = (taskId: string | null, error: unknown) => void
type Obligation = {
  promise: Promise<CoachStopResult>
  controller: AbortController
  listeners: Set<StopFailure>
  taskId: string | null
  lastFailure?: unknown
  finish: (result: CoachStopResult) => void
}
const obligations = new Map<string, Obligation>()
const observers = new Map<string, Set<StopFailure>>()
const REQUEST_TIMEOUT_MS = 5000
const OBLIGATION_TIMEOUT_MS = 30000
let sessionId: string | null = null

function taskKey(chatId: string, taskId: string) {
  return `task:${chatId}:${taskId}`
}

export function observeCoachStop(
  chatId: string,
  taskId: string,
  listener: StopFailure
) {
  const key = taskKey(chatId, taskId)
  let listeners = observers.get(key)
  if (!listeners) {
    listeners = new Set()
    observers.set(key, listeners)
  }
  listeners.add(listener)
  const entry = obligations.get(key)
  if (entry?.lastFailure) listener(taskId, entry.lastFailure)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) observers.delete(key)
  }
}

export function completeCoachStop(chatId: string, taskId: string) {
  obligations.get(taskKey(chatId, taskId))?.finish({ ok: true, taskId })
}

export function disposeCoachStops() {
  for (const entry of new Set(obligations.values()))
    entry.finish({
      ok: false,
      taskId: entry.taskId,
      error: new Error("Session ended"),
    })
}

export function setCoachStopSession(next: string | null) {
  if (sessionId !== next) disposeCoachStops()
  sessionId = next
}

export function resetCoachStopsForTests() {
  if (import.meta.env.MODE !== "test")
    throw new Error("Test reset is unavailable")
  disposeCoachStops()
  observers.clear()
  sessionId = null
}

async function request<T>(
  signal: AbortSignal,
  operation: (signal: AbortSignal) => Promise<T>
) {
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener("abort", abort, { once: true })
  if (signal.aborted) abort()
  const timer = setTimeout(
    () => controller.abort(new Error("Coach Stop request timed out")),
    REQUEST_TIMEOUT_MS
  )
  try {
    return await new Promise<T>((resolve, reject) => {
      const cancel = () => reject(controller.signal.reason)
      controller.signal.addEventListener("abort", cancel, { once: true })
      if (controller.signal.aborted) cancel()
      else {
        try {
          operation(controller.signal).then(resolve, reject)
        } catch (error) {
          reject(error)
        }
      }
    })
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", abort)
    controller.abort()
  }
}

export function fulfillCoachStop(
  target: CoachStopTarget,
  transport: StopTransport,
  onFailure: StopFailure = () => undefined
): Promise<CoachStopResult> {
  const chatId = target.kind === "task" ? target.chatId : target.input.chatId
  const key =
    target.kind === "task"
      ? taskKey(chatId, target.taskId)
      : `start:${chatId}:${target.startKey}`
  const existing = obligations.get(key)
  if (existing) {
    existing.listeners.add(onFailure)
    if (existing.lastFailure) onFailure(existing.taskId, existing.lastFailure)
    return existing.promise
  }
  const controller = new AbortController()
  let resolve!: (result: CoachStopResult) => void
  const promise = new Promise<CoachStopResult>((done) => {
    resolve = done
  })
  const entry: Obligation = {
    promise,
    controller,
    listeners: new Set([onFailure]),
    taskId: target.kind === "task" ? target.taskId : null,
    finish(result) {
      if (controller.signal.aborted) return
      clearTimeout(deadline)
      for (const [alias, owned] of obligations)
        if (owned === entry) obligations.delete(alias)
      controller.abort()
      if (target.kind === "start") target.controller?.abort()
      entry.listeners.clear()
      resolve(result)
    },
  }
  const fail = (error: unknown) => {
    if (controller.signal.aborted) return
    entry.lastFailure = error
    const listeners = new Set(entry.listeners)
    if (entry.taskId)
      for (const listener of observers.get(taskKey(chatId, entry.taskId)) ?? [])
        listeners.add(listener)
    for (const listener of listeners) listener(entry.taskId, error)
  }
  const deadline = setTimeout(() => {
    const error = new Error("Coach Stop timed out. Please retry.")
    fail(error)
    entry.finish({ ok: false, taskId: entry.taskId, error })
  }, OBLIGATION_TIMEOUT_MS)
  obligations.set(key, entry)
  let retries = 0
  const delay = () =>
    request(controller.signal, (signal) =>
      transport.retryDelay(retries++, signal)
    )
  const run = async (): Promise<CoachStopResult> => {
    let error: unknown
    if (target.kind === "start") {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const started = await request(controller.signal, async (signal) => {
            if (attempt !== 0 || !target.pending)
              return transport.start(target.input, target.startKey, signal)
            const abort = () => target.controller?.abort()
            signal.addEventListener("abort", abort, { once: true })
            try {
              return await target.pending
            } finally {
              signal.removeEventListener("abort", abort)
            }
          })
          entry.taskId = started.taskId
          break
        } catch (failure) {
          controller.signal.throwIfAborted()
          error = failure
          if (attempt < 2) await delay()
        }
      }
    }
    controller.signal.throwIfAborted()
    const taskId = entry.taskId
    if (!taskId) {
      fail(error)
      return { ok: false, taskId: null, error }
    }
    if (target.kind === "start") {
      const alias = taskKey(chatId, taskId)
      const active = obligations.get(alias)
      if (active && active !== entry) {
        const listener: StopFailure = (_, error) => fail(error)
        active.listeners.add(listener)
        if (active.lastFailure) fail(active.lastFailure)
        try {
          return await active.promise
        } finally {
          active.listeners.delete(listener)
        }
      }
      obligations.set(alias, entry)
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await request(controller.signal, (signal) =>
          transport.stop(chatId, taskId, signal)
        )
        return { ok: true, taskId }
      } catch (failure) {
        controller.signal.throwIfAborted()
        error = failure
        fail(failure)
        if (attempt < 2) await delay()
      }
    }
    return { ok: false, taskId, error }
  }
  void run().then(
    (result) => entry.finish(result),
    (error: unknown) => {
      fail(error)
      entry.finish({ ok: false, taskId: entry.taskId, error })
    }
  )
  return promise
}
