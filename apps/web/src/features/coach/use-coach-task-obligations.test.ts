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
  taskStarted,
} from "@/test/coach-task-fixture.ts"
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

import { STREAMING_COACH_ID } from "./chat-messages.ts"
import {
  coachTaskLifecycleReducer as reviewReduce,
  idleCoachTask as reviewIdle,
} from "./coach-task-lifecycle.ts"
import { taskFromSnapshot as reviewSnapshot } from "@/lib/coach-task-state.ts"

const NEW_TASK = "01900000-0000-7000-8000-000000000004"

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

it("regression: Stop during recovery and concurrent discovery reaches only original task", async () => {
  const recovery = deferred<void>()
  const stops: unknown[] = []
  let starts = 0
  let discovered: string | null = null
  reviewFetch(
    async (path, body) => {
      if (path.endsWith("coach.start")) {
        starts++
        if (starts === 1) throw new Error("lost response")
        await recovery.promise
        return Response.json({ ok: true, data: taskStarted(TASK) })
      }
      if (path.endsWith("coach.stop")) {
        stops.push(body())
        return Response.json({ ok: true, data: { stopped: true } })
      }
      if (path.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({ state: "cancelled" }),
        })
      return null
    },
    () => discovered
  )
  const hook = mount(CHAT)
  try {
    act(() => {
      hook.result.current.send("Original")
    })
    await waitFor(() => expect(hook.result.current.error).toBeTruthy())
    act(() => {
      expect(hook.result.current.retry()).toBe(true)
    })
    await waitFor(() => expect(starts).toBe(2))
    discovered = NEW_TASK
    act(() =>
      hook.client.setQueryData(["chat.get", { chatId: CHAT }], {
        id: CHAT,
        messages: [],
        activeTaskId: discovered,
      })
    )
    await act(async () => {})
    act(() => hook.result.current.stop())
    await act(async () => recovery.resolve())
    await waitFor(() => expect(stops).toEqual([{ chatId: CHAT, taskId: TASK }]))
  } finally {
    hook.unmount()
    hook.client.clear()
  }
})

it("regression: discovering a newer task during replay must be reconciled after original terminal snapshot", async () => {
  const recovery = deferred<void>()
  let starts = 0
  let discovered: string | null = null
  const newTaskReads = vi.fn()
  reviewFetch(
    async (path) => {
      if (path.endsWith("coach.start")) {
        starts++
        if (starts === 1) throw new Error("lost response")
        await recovery.promise
        return Response.json({ ok: true, data: taskStarted(TASK) })
      }
      if (path.includes(`/coach/tasks/${NEW_TASK}`)) {
        newTaskReads()
        return Response.json({
          ok: true,
          data: taskSnapshot({ taskId: NEW_TASK, state: "running" }),
        })
      }
      if (path.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({ state: "succeeded" }),
        })
      return null
    },
    () => discovered
  )
  const hook = mount(CHAT)
  try {
    act(() => {
      hook.result.current.send("Original")
    })
    await waitFor(() => expect(hook.result.current.error).toBeTruthy())
    act(() => {
      hook.result.current.retry()
    })
    await waitFor(() => expect(starts).toBe(2))
    discovered = NEW_TASK
    act(() =>
      hook.client.setQueryData(["chat.get", { chatId: CHAT }], {
        id: CHAT,
        messages: [],
        activeTaskId: NEW_TASK,
      })
    )
    await act(async () => {})
    await act(async () => recovery.resolve())
    await waitFor(() => expect(newTaskReads).toHaveBeenCalled())
  } finally {
    hook.unmount()
    hook.client.clear()
  }
})

it("regression: Stop followed by detach before acceptance must still stop original task", async () => {
  const acceptance = deferred<void>()
  const stops: unknown[] = []
  let starts = 0
  reviewFetch(async (path, body) => {
    if (path.endsWith("coach.start")) {
      starts++
      await acceptance.promise
      return Response.json({ ok: true, data: taskStarted(TASK) })
    }
    if (path.endsWith("coach.stop")) {
      stops.push(body())
      return Response.json({ ok: true, data: { stopped: true } })
    }
    if (path.includes("/coach/tasks/"))
      return Response.json({
        ok: true,
        data: taskSnapshot({ state: "cancelled" }),
      })
    return null
  })
  const hook = mount(CHAT)
  try {
    act(() => {
      hook.result.current.send("Original")
    })
    await waitFor(() => expect(starts).toBe(1))
    act(() => hook.result.current.stop())
    act(() => hook.result.current.cancelInFlight())
    await act(async () => acceptance.resolve())
    expect(stops).toEqual([{ chatId: CHAT, taskId: TASK }])
  } finally {
    hook.unmount()
    hook.client.clear()
  }
})

it("regression: Retry shown for stopFailed must retry cancellation", async () => {
  const stops: unknown[] = []
  reviewFetch(async (path, body) => {
    if (path.endsWith("coach.start"))
      return Response.json({ ok: true, data: taskStarted(TASK) })
    if (path.endsWith("coach.stop")) {
      stops.push(body())
      if (stops.length === 1) throw new Error("stop request lost")
      return Response.json({ ok: true, data: { stopped: true } })
    }
    if (path.endsWith("/events")) return new Response("")
    if (path.includes("/coach/tasks/"))
      return Response.json({
        ok: true,
        data: taskSnapshot({ state: "running" }),
      })
    return null
  })
  const hook = mount(CHAT)
  try {
    act(() => {
      hook.result.current.send("Original")
    })
    await waitFor(() =>
      expect(
        hook.result.current.messages.some((m) => m.id === STREAMING_COACH_ID)
      ).toBe(true)
    )
    act(() => hook.result.current.stop())
    await waitFor(() => expect(hook.result.current.error).toBeTruthy())
    let accepted = false
    act(() => {
      accepted = hook.result.current.retry()
    })
    expect(accepted).toBe(true)
    await waitFor(() => expect(stops).toHaveLength(2))
  } finally {
    hook.unmount()
    hook.client.clear()
  }
})

it("regression: detach after cancellation dispatch does not abort the sent request", async () => {
  const stopped = deferred<void>()
  const stops: unknown[] = []
  reviewFetch(async (path, body) => {
    if (path.endsWith("coach.start"))
      return Response.json({ ok: true, data: taskStarted(TASK) })
    if (path.endsWith("coach.stop")) {
      stops.push(body())
      await stopped.promise
      return Response.json({ ok: true, data: { stopped: true } })
    }
    if (path.endsWith("/events")) return new Response("")
    if (path.includes("/coach/tasks/"))
      return Response.json({
        ok: true,
        data: taskSnapshot({ state: "running" }),
      })
    return null
  })
  const hook = mount(CHAT)
  try {
    act(() => {
      hook.result.current.send("Original")
    })
    await waitFor(() =>
      expect(
        hook.result.current.messages.some((m) => m.id === STREAMING_COACH_ID)
      ).toBe(true)
    )
    act(() => {
      hook.result.current.stop()
      hook.result.current.cancelInFlight()
    })
    expect(stops).toEqual([{ chatId: CHAT, taskId: TASK }])
    await act(async () => stopped.resolve())
    expect(hook.result.current.phase).toBe("idle")
  } finally {
    hook.unmount()
    hook.client.clear()
  }
})

it("regression: lifecycle reducer is deterministic and accepts frozen states and events", () => {
  const request = Object.freeze({
    text: "Original",
    sendOptions: Object.freeze({}),
    regenerate: false,
    startKey: TASK,
  })
  const state = Object.freeze(
    reviewReduce(
      Object.freeze({ ...reviewIdle }),
      Object.freeze({ type: "send", request })
    )
  )
  const input = Object.freeze({ chatId: CHAT, text: "Original" })
  const sent = Object.freeze(
    reviewReduce(
      state,
      Object.freeze({
        type: "startSent",
        generation: state.generation,
        startKey: TASK,
        input,
      })
    )
  )
  const event = Object.freeze({
    type: "startAccepted" as const,
    generation: sent.generation,
    startKey: TASK,
    taskId: TASK,
  })
  expect(reviewReduce(sent, event)).toEqual(reviewReduce(sent, event))
  expect(sent.kind).toBe("starting")
  const early = Object.freeze({
    type: "snapshot" as const,
    generation: sent.generation,
    task: reviewSnapshot(taskSnapshot({ state: "succeeded" })),
  })
  expect(reviewReduce(sent, early)).toBe(sent)
})

it("regression: completed task observed in Chat before start acceptance still becomes terminal", async () => {
  const acceptance = deferred<void>()
  let starts = 0
  let discovered: string | null = null
  const reads = vi.fn()
  reviewFetch(
    async (path) => {
      if (path.endsWith("coach.start")) {
        starts++
        await acceptance.promise
        return Response.json({ ok: true, data: taskStarted(TASK) })
      }
      if (path.includes("/coach/tasks/")) {
        reads()
        return Response.json({
          ok: true,
          data: taskSnapshot({ state: "succeeded" }),
        })
      }
      return null
    },
    () => discovered
  )
  const hook = mount(CHAT)
  try {
    act(() => {
      hook.result.current.send("Original")
    })
    await waitFor(() => expect(starts).toBe(1))
    discovered = TASK
    act(() =>
      hook.client.setQueryData(["chat.get", { chatId: CHAT }], {
        id: CHAT,
        messages: [],
        activeTaskId: TASK,
      })
    )
    await act(async () => {})
    expect(reads).not.toHaveBeenCalled()
    await act(async () => acceptance.resolve())
    await waitFor(() => expect(reads).toHaveBeenCalled())
    await waitFor(() => expect(hook.result.current.phase).toBe("idle"))
  } finally {
    hook.unmount()
    hook.client.clear()
  }
})

it("regression: second Stop after stopFailed retries the same task", async () => {
  const stops: unknown[] = []
  let starts = 0
  reviewFetch(async (path, body) => {
    if (path.endsWith("coach.start")) {
      starts++
      return Response.json({ ok: true, data: taskStarted(TASK) })
    }
    if (path.endsWith("coach.stop")) {
      stops.push(body())
      if (stops.length === 1) throw new Error("failed stop")
      return Response.json({ ok: true, data: { stopped: true } })
    }
    if (path.endsWith("/events")) return new Response("")
    if (path.includes("/coach/tasks/"))
      return Response.json({
        ok: true,
        data: taskSnapshot({
          state: stops.length === 2 ? "cancelled" : "running",
        }),
      })
    return null
  })
  const hook = mount(CHAT)
  try {
    act(() => {
      hook.result.current.send("Original")
    })
    await waitFor(() =>
      expect(
        hook.result.current.messages.some((m) => m.id === STREAMING_COACH_ID)
      ).toBe(true)
    )
    act(() => hook.result.current.stop())
    await waitFor(() => expect(hook.result.current.error).toBeTruthy())
    act(() => hook.result.current.stop())
    await waitFor(() => expect(stops).toHaveLength(2))
    expect(stops).toEqual([
      { chatId: CHAT, taskId: TASK },
      { chatId: CHAT, taskId: TASK },
    ])
    expect(starts).toBe(1)
  } finally {
    hook.unmount()
    hook.client.clear()
  }
})

it("fulfills Stop after unmount when the original start response is lost", async () => {
  const acceptance = deferred<void>()
  const starts: unknown[] = []
  const stops: unknown[] = []
  reviewFetch(async (path, body) => {
    if (path.endsWith("coach.start")) {
      starts.push(body())
      if (starts.length === 1) {
        await acceptance.promise
        throw new Error("lost acceptance")
      }
      return Response.json({ ok: true, data: taskStarted(TASK) })
    }
    if (path.endsWith("coach.stop")) {
      stops.push(body())
      return Response.json({ ok: true, data: { stopped: true } })
    }
    return null
  })
  const hook = mount(CHAT)
  act(() =>
    hook.result.current.send("Original", {
      context: [{ kind: "job", id: TASK }],
    })
  )
  await waitFor(() => expect(starts).toHaveLength(1))
  act(() => hook.result.current.stop())
  hook.unmount()
  await act(async () => acceptance.resolve())
  await waitFor(() => expect(stops).toEqual([{ chatId: CHAT, taskId: TASK }]))
  expect(starts).toEqual([starts[0], starts[0]])
  hook.client.clear()
})

it("Retry after exhausted Stop failures retries the original terminal task without regeneration", async () => {
  const starts: unknown[] = []
  const stops: unknown[] = []
  let failed = true
  let stream!: ReadableStreamDefaultController<Uint8Array>
  reviewFetch(async (path, body) => {
    if (path.endsWith("coach.start")) {
      starts.push(body())
      return Response.json({ ok: true, data: taskStarted(TASK) })
    }
    if (path.endsWith("coach.stop")) {
      stops.push(body())
      if (failed) throw new Error("forced Stop failure")
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
  })
  const hook = mount(CHAT)
  try {
    act(() => hook.result.current.send("Original"))
    await waitFor(() => expect(hook.result.current.progress.active).toBe(true))
    act(() => hook.result.current.stop())
    await waitFor(() => expect(stops).toHaveLength(3))
    act(() => {
      stream.enqueue(
        new TextEncoder().encode(
          `event: reset\ndata: ${JSON.stringify({ type: "reset", reason: "gap", snapshot: taskSnapshot({ state: "succeeded" }) })}\n\n`
        )
      )
      stream.close()
    })
    await waitFor(() => expect(hook.result.current.progress.active).toBe(false))
    failed = false
    act(() => expect(hook.result.current.retry()).toBe(true))
    await waitFor(() => expect(stops).toHaveLength(4))
    expect(stops).toEqual(
      Array.from({ length: 4 }, () => ({ chatId: CHAT, taskId: TASK }))
    )
    expect(starts).toHaveLength(1)
    await waitFor(() => expect(hook.result.current.progress.active).toBe(false))
    act(() => expect(hook.result.current.send("Next reply")).toBe(true))
    await waitFor(() => expect(starts).toHaveLength(2))
  } finally {
    hook.unmount()
    hook.client.clear()
  }
})

it.each(["Stop", "Retry"])(
  "%s after task discovery preserves the intended cancellation identity",
  async (action) => {
    const NEW_TASK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    let discovered: string | null = null
    const newTaskReads = vi.fn()
    const starts: unknown[] = []
    const stops: unknown[] = []
    let failed = true
    let stream!: ReadableStreamDefaultController<Uint8Array>
    reviewFetch(
      async (path, body) => {
        if (path.endsWith("coach.start")) {
          starts.push(body())
          return Response.json({ ok: true, data: taskStarted(TASK) })
        }
        if (path.endsWith("coach.stop")) {
          stops.push(body())
          if (failed) throw new Error("forced Stop failure")
          return Response.json({ ok: true, data: { stopped: true } })
        }
        if (path.includes(`/coach/tasks/${NEW_TASK}`)) {
          newTaskReads()
          return Response.json({
            ok: true,
            data: taskSnapshot({ taskId: NEW_TASK, state: "running" }),
          })
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
      () => discovered
    )
    const hook = mount(CHAT)
    try {
      act(() => hook.result.current.send("Original"))
      await waitFor(() =>
        expect(hook.result.current.progress.active).toBe(true)
      )
      act(() => hook.result.current.stop())
      await waitFor(() => expect(stops).toHaveLength(3))
      discovered = NEW_TASK
      act(() =>
        hook.client.setQueryData(["chat.get", { chatId: CHAT }], {
          id: CHAT,
          messages: [],
          activeTaskId: NEW_TASK,
        })
      )
      act(() => {
        stream.enqueue(
          new TextEncoder().encode(
            `event: reset\ndata: ${JSON.stringify({ type: "reset", reason: "gap", snapshot: taskSnapshot({ state: "succeeded" }) })}\n\n`
          )
        )
        stream.close()
      })
      await waitFor(() => expect(newTaskReads).toHaveBeenCalled())
      failed = false
      act(() =>
        expect(
          action === "Stop"
            ? hook.result.current.stop()
            : hook.result.current.retry()
        ).toBe(true)
      )
      await waitFor(() => expect(stops).toHaveLength(4))
      expect(stops).toEqual([
        ...Array.from({ length: 3 }, () => ({ chatId: CHAT, taskId: TASK })),
        { chatId: CHAT, taskId: action === "Stop" ? NEW_TASK : TASK },
      ])
      expect(starts).toHaveLength(1)
    } finally {
      hook.unmount()
      hook.client.clear()
    }
  }
)
