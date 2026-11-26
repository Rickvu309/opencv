import { expect, it, vi } from "vitest"
import { CHAT, TASK } from "@/test/coach-task-fixture.ts"
import {
  fulfillCoachStop,
  type CoachStopTarget,
} from "./coach-stop-obligations.ts"

const target: CoachStopTarget = { kind: "task", chatId: CHAT, taskId: TASK }
function transport() {
  return {
    start: vi.fn(async () => ({ taskId: TASK })),
    stop: vi.fn<(chatId: string, taskId: string) => Promise<void>>(
      async () => undefined
    ),
    retryDelay: vi.fn(async () => undefined),
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

it("owns the exact pending start through view detachment and deduplicates Stop", async () => {
  const start = deferred<{ taskId: string }>()
  const io = transport()
  const original: CoachStopTarget = {
    kind: "start",
    startKey: TASK,
    input: { chatId: CHAT, text: "Original" },
    pending: start.promise,
  }
  const obligation = fulfillCoachStop(original, io)
  expect(fulfillCoachStop(original, io)).toBe(obligation)
  expect(io.stop).not.toHaveBeenCalled()
  start.resolve({ taskId: TASK })
  expect(await obligation).toEqual({ ok: true, taskId: TASK })
  expect(io.start).not.toHaveBeenCalled()
  expect(
    io.stop.mock.calls.map(([chatId, taskId]) => [chatId, taskId])
  ).toEqual([[CHAT, TASK]])
})

it("recovers a lost response with the identical start key and full input", async () => {
  const io = transport()
  const input = {
    chatId: CHAT,
    text: "Original",
    context: [{ kind: "job" as const, id: TASK }],
  }
  const pending = Promise.reject(new Error("lost"))
  expect(
    await fulfillCoachStop(
      { kind: "start", startKey: TASK, input, pending },
      io
    )
  ).toEqual({ ok: true, taskId: TASK })
  expect(
    io.start.mock.calls.map((call: unknown[]) => [call[0], call[1]])
  ).toEqual([[input, TASK]])
  expect(
    io.stop.mock.calls.map(([chatId, taskId]) => [chatId, taskId])
  ).toEqual([[CHAT, TASK]])
})

it("bounds recovery failures without ever targeting discovered work", async () => {
  const io = transport()
  io.start.mockRejectedValue(new Error("offline"))
  const result = await fulfillCoachStop(
    {
      kind: "start",
      startKey: TASK,
      input: { chatId: CHAT, text: "Original" },
      pending: null,
    },
    io
  )
  expect(result).toMatchObject({ ok: false, taskId: null })
  expect(io.start).toHaveBeenCalledTimes(3)
  expect(io.stop).not.toHaveBeenCalled()
  expect(io.retryDelay).toHaveBeenCalledTimes(2)
})

it("bounds failed Stops, retains their concrete identity and releases the entry for Retry", async () => {
  const io = transport()
  const error = new Error("offline")
  io.stop.mockRejectedValue(error)
  const onFailure = vi.fn()
  expect(await fulfillCoachStop(target, io, onFailure)).toEqual({
    ok: false,
    taskId: TASK,
    error,
  })
  expect(
    io.stop.mock.calls.map(([chatId, taskId]) => [chatId, taskId])
  ).toEqual([
    [CHAT, TASK],
    [CHAT, TASK],
    [CHAT, TASK],
  ])
  expect(onFailure).toHaveBeenCalledTimes(3)
  io.stop.mockResolvedValue(undefined)
  expect(await fulfillCoachStop(target, io)).toEqual({ ok: true, taskId: TASK })
  expect(io.start).not.toHaveBeenCalled()
  expect(io.stop).toHaveBeenCalledTimes(4)
})

it("retries a transient Stop failure and removes successful obligations", async () => {
  const io = transport()
  io.stop.mockRejectedValueOnce(new Error("lost"))
  expect(await fulfillCoachStop(target, io)).toEqual({ ok: true, taskId: TASK })
  expect(io.stop).toHaveBeenCalledTimes(2)
  await fulfillCoachStop(target, io)
  expect(io.stop).toHaveBeenCalledTimes(3)
})

it("keeps concurrent tasks independent", async () => {
  const io = transport()
  const first = deferred<undefined>()
  io.stop.mockImplementationOnce(() => first.promise)
  const pending = fulfillCoachStop(target, io)
  const newer = "01900000-0000-7000-8000-000000000003"
  expect(
    await fulfillCoachStop({ kind: "task", chatId: CHAT, taskId: newer }, io)
  ).toEqual({ ok: true, taskId: newer })
  first.resolve(undefined)
  await pending
  expect(
    io.stop.mock.calls.map(([chatId, taskId]) => [chatId, taskId])
  ).toEqual([
    [CHAT, TASK],
    [CHAT, newer],
  ])
})

it("recovers an indefinitely pending start without retaining its request", async () => {
  vi.useFakeTimers()
  const io = transport()
  const pending = deferred<{ taskId: string }>()
  const controller = new AbortController()
  const obligation = fulfillCoachStop(
    {
      kind: "start",
      startKey: TASK,
      input: { chatId: CHAT, text: "Original" },
      pending: pending.promise,
      controller,
    },
    io
  )
  try {
    await vi.advanceTimersByTimeAsync(5000)
    expect(controller.signal.aborted).toBe(true)
    expect(io.start).toHaveBeenCalledTimes(1)
    expect(await obligation).toEqual({ ok: true, taskId: TASK })
    expect(io.stop).toHaveBeenCalledTimes(1)
    pending.resolve({ taskId: TASK })
    await Promise.resolve()
    expect(io.stop).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})

it("aborts hanging Stop requests and releases the obligation after bounded attempts", async () => {
  vi.useFakeTimers()
  const signals: AbortSignal[] = []
  const io = {
    start: async () => ({ taskId: TASK }),
    stop: vi.fn((_chat: string, _task: string, signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<void>(() => {})
    }),
    retryDelay: async () => {},
  }
  const obligation = fulfillCoachStop(target, io)
  try {
    await vi.advanceTimersByTimeAsync(15000)
    expect(await obligation).toMatchObject({ ok: false, taskId: TASK })
    expect(signals).toHaveLength(3)
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    const nextIo = transport()
    expect(await fulfillCoachStop(target, nextIo)).toEqual({
      ok: true,
      taskId: TASK,
    })
    expect(nextIo.stop).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})

it("bounds the entire recovery and Stop obligation even when both phases hang", async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  const io = {
    start: vi.fn(async (_input: unknown, _key: string, signal: AbortSignal) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 4900)
      })
      signal.throwIfAborted()
      if (io.start.mock.calls.length < 2) throw new Error("lost")
      return { taskId: TASK }
    }),
    stop: vi.fn<
      (chatId: string, taskId: string, signal: AbortSignal) => Promise<void>
    >(() => new Promise<void>(() => {})),
    retryDelay: async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000)
      })
    },
  }
  const failure = vi.fn()
  const obligation = fulfillCoachStop(
    {
      kind: "start",
      startKey: TASK,
      input: { chatId: CHAT, text: "Original" },
      pending: new Promise(() => {}),
      controller,
    },
    io,
    failure
  )
  try {
    await vi.advanceTimersByTimeAsync(30000)
    expect(await obligation).toMatchObject({ ok: false, taskId: TASK })
    expect(controller.signal.aborted).toBe(true)
    expect(failure).toHaveBeenCalled()
    expect(await fulfillCoachStop(target, transport())).toEqual({
      ok: true,
      taskId: TASK,
    })
  } finally {
    vi.useRealTimers()
  }
})
