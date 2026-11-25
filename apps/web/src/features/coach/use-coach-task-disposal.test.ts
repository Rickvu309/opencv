import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createElement, StrictMode, useReducer, type ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { chatApiFetchOrThrow, setMockChats } from "@/test/chat-api-mock.ts"
import {
  taskPathOf,
  CHAT,
  TASK,
  taskSnapshot,
} from "@/test/coach-task-fixture.ts"
import { STREAMING_COACH_ID } from "./chat-messages.ts"
import { fulfillCoachStop as reviewFulfill } from "./coach-stop-obligations.ts"
import { useCoachTask } from "./use-coach-task.ts"

afterEach(() => vi.unstubAllGlobals())

function mount(initialChatId: string | null = null, strict = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      strict ? createElement(StrictMode, null, children) : children
    )
  const hook = renderHook(
    () => {
      const [chatId, setChatId] = useReducer(
        (_: string | null, next: string | null) => next,
        initialChatId
      )
      const turn = useCoachTask(
        { chatId, setChatId, titleForCreate: (text) => text },
        true
      )
      return {
        ...turn,
        switchChat: (id: string) => {
          turn.cancelInFlight()
          setChatId(id)
        },
      }
    },
    { wrapper }
  )
  return { ...hook, client }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function reviewFetch(
  handler: (
    path: string,
    body: () => Record<string, unknown>
  ) => Promise<Response | null>,
  active: () => string | null = () => null
) {
  setMockChats([{ id: CHAT, title: "Round 3" }])
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = taskPathOf(input, init)
      const response = await handler(
        path,
        () => JSON.parse(String(init?.body)).input
      )
      if (response) return response
      const fallback = await chatApiFetchOrThrow(input, init)
      if (path === "/api/reads/chat.get") {
        const body = await fallback.json()
        return Response.json({
          ...body,
          data: { ...body.data, activeTaskId: active() },
        })
      }
      return fallback
    }
  )
}

it.each([false, true])(
  "round4: Stop failure reaches a remounted view with another Stop press %s",
  async (pressStop) => {
    const gate = deferred<void>()
    const stops: unknown[] = []
    reviewFetch(
      async (path, body) => {
        if (path.endsWith("coach.start"))
          return Response.json({ ok: true, data: { taskId: TASK } })
        if (path.endsWith("coach.stop")) {
          stops.push(body())
          await gate.promise
          throw new Error("forced stop failure")
        }
        if (path.endsWith("/events")) return new Response("")
        if (path.includes("/coach/tasks/"))
          return Response.json({
            ok: true,
            data: taskSnapshot({ state: "running" }),
          })
        return null
      },
      () => TASK
    )
    const original = mount(CHAT)
    await waitFor(() =>
      expect(
        original.result.current.messages.some(
          (m) => m.id === STREAMING_COACH_ID
        )
      ).toBe(true)
    )
    act(() => original.result.current.stop())
    await waitFor(() => expect(stops).toHaveLength(1))
    original.unmount()
    original.client.clear()
    const returned = mount(CHAT)
    try {
      await waitFor(() =>
        expect(
          returned.result.current.messages.some(
            (m) => m.id === STREAMING_COACH_ID
          )
        ).toBe(true)
      )
      if (pressStop)
        act(() => expect(returned.result.current.stop()).toBe(true))
      expect(stops).toHaveLength(1)
      await act(async () => gate.resolve())
      await waitFor(() => expect(stops).toHaveLength(3))
      await waitFor(() => expect(returned.result.current.error).toBeTruthy())
    } finally {
      gate.resolve()
      returned.unmount()
      returned.client.clear()
    }
  }
)

const reviewBleedTarget = {
  kind: "task" as const,
  chatId: CHAT,
  taskId: "01900000-0000-7000-8000-000000000099",
}
const reviewBleedGate = deferred<void>()
let reviewBleedPromise: ReturnType<typeof reviewFulfill>
it("round4: fixture leaves an unfinished Stop at test teardown", () => {
  reviewBleedPromise = reviewFulfill(reviewBleedTarget, {
    start: async () => ({ taskId: reviewBleedTarget.taskId }),
    stop: () => reviewBleedGate.promise,
    retryDelay: async () => undefined,
  })
})
it("round4: next test must not inherit the previous Stop registry", async () => {
  const io = {
    start: vi.fn(async () => ({ taskId: reviewBleedTarget.taskId })),
    stop: vi.fn(async () => undefined),
    retryDelay: async () => undefined,
  }
  const next = reviewFulfill(reviewBleedTarget, io)
  try {
    expect(next).not.toBe(reviewBleedPromise)
    expect(io.stop).toHaveBeenCalledTimes(1)
  } finally {
    reviewBleedGate.resolve()
    await reviewBleedPromise
    await next
  }
})

it("round4: task and start aliases deduplicate the same Stop", async () => {
  const gate = deferred<void>()
  const stop = vi.fn(() => gate.promise)
  const io = {
    start: async () => ({ taskId: TASK }),
    stop,
    retryDelay: async () => undefined,
  }
  const original = reviewFulfill(
    { kind: "task", chatId: CHAT, taskId: TASK },
    io
  )
  const alias = reviewFulfill(
    {
      kind: "start",
      startKey: "01900000-0000-7000-8000-000000000097",
      input: { chatId: CHAT, text: "Original" },
      pending: Promise.resolve({ taskId: TASK }),
    },
    io
  )
  await Promise.resolve()
  expect(stop).toHaveBeenCalledTimes(1)
  gate.resolve()
  expect(await original).toEqual({ ok: true, taskId: TASK })
  expect(await alias).toEqual({ ok: true, taskId: TASK })
  await reviewFulfill({ kind: "task", chatId: CHAT, taskId: TASK }, io)
  expect(stop).toHaveBeenCalledTimes(2)
})

it("round4: terminal snapshot releases an outstanding Stop registry entry", async () => {
  const gate = deferred<void>()
  let stream!: ReadableStreamDefaultController<Uint8Array>
  const stops: unknown[] = []
  reviewFetch(
    async (path, body) => {
      if (path.endsWith("coach.stop")) {
        stops.push(body())
        await gate.promise
        return Response.json({ ok: true, data: { stopped: true } })
      }
      if (path.endsWith("/events"))
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              stream = controller
            },
          })
        )
      if (path.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({ state: "running" }),
        })
      return null
    },
    () => TASK
  )
  const hook = mount(CHAT)
  let held: ReturnType<typeof reviewFulfill> | undefined
  try {
    await waitFor(() => expect(stream).toBeDefined())
    act(() => hook.result.current.stop())
    await waitFor(() => expect(stops).toHaveLength(1))
    const io = {
      start: async () => ({ taskId: TASK }),
      stop: vi.fn(async () => undefined),
      retryDelay: async () => undefined,
    }
    const target = { kind: "task" as const, chatId: CHAT, taskId: TASK }
    held = reviewFulfill(target, io)
    act(() => {
      stream.enqueue(
        new TextEncoder().encode(
          `event: reset\ndata: ${JSON.stringify({ type: "reset", reason: "gap", snapshot: taskSnapshot({ state: "cancelled" }) })}\n\n`
        )
      )
      stream.close()
    })
    await waitFor(() => expect(hook.result.current.progress.active).toBe(false))
    hook.unmount()
    hook.client.clear()
    const next = reviewFulfill(target, io)
    expect(next).not.toBe(held)
  } finally {
    gate.resolve()
    await held
    hook.unmount()
    hook.client.clear()
  }
})
