import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createElement, StrictMode, useReducer, type ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { parseChatId } from "@workspace/domain"

import {
  chatApiFetchOrThrow,
  chatCreateCalls,
  setMockChats,
} from "@/test/chat-api-mock.ts"
import { CHAT, TASK, taskSnapshot } from "@/test/coach-task-fixture.ts"
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

it("retries an interrupted start with the same chat, invocation key and attachments", async () => {
  const inputs: Array<Record<string, unknown>> = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith("coach.start")) {
        const body = JSON.parse(String(init?.body)) as {
          input: Record<string, unknown>
        }
        inputs.push(body.input)
        if (inputs.length === 1) throw new Error("connection lost")
        return Response.json({ ok: true, data: { taskId: TASK } })
      }
      if (url.pathname.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({
            state: "succeeded",
            chatId: parseChatId(String(inputs.at(-1)?.chatId)),
          }),
        })
      return chatApiFetchOrThrow(input, init)
    }
  )
  const hook = mount()
  act(() => {
    expect(
      hook.result.current.send("Update this Job", {
        context: [{ kind: "job", id: TASK }],
      })
    ).toBe(true)
  })
  await waitFor(() => expect(hook.result.current.error).toBeTruthy())
  act(() => {
    expect(hook.result.current.retry()).toBe(true)
  })
  await waitFor(() => expect(inputs).toHaveLength(2))
  await waitFor(() => expect(hook.result.current.phase).toBe("idle"))
  expect(inputs[1]).toEqual(inputs[0])
  expect(chatCreateCalls()).toHaveLength(1)
  hook.unmount()
})

it("regenerates a persisted failed reply without appending its person message again", async () => {
  setMockChats([{ id: CHAT, title: "Saved Chat" }])
  const inputs: Array<Record<string, unknown>> = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith("coach.start")) {
        inputs.push(
          (JSON.parse(String(init?.body)) as { input: Record<string, unknown> })
            .input
        )
        return Response.json({ ok: true, data: { taskId: TASK } })
      }
      if (url.pathname.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({ state: "failed" }),
        })
      const response = await chatApiFetchOrThrow(input, init)
      if (url.pathname === `/api/chats/${CHAT}`) {
        const body = (await response.json()) as {
          data: Record<string, unknown>
        }
        return Response.json({
          ok: true,
          data: { ...body.data, activeTaskId: TASK },
        })
      }
      return response
    }
  )
  const hook = mount(CHAT)
  await waitFor(() =>
    expect(hook.result.current.error).toBe("The Coach stopped. Try again.")
  )
  act(() => {
    expect(hook.result.current.retry()).toBe(true)
  })
  await waitFor(() => expect(inputs).toHaveLength(1))
  expect(inputs[0]).toMatchObject({ chatId: CHAT, regenerate: true })
  expect(inputs[0]).not.toHaveProperty("text")
  hook.unmount()
})

it("tells the truth when a turn hits its limit and does not send it again", async () => {
  setMockChats([{ id: CHAT, title: "Saved Chat" }])
  const starts = vi.fn()
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith("coach.start")) {
        starts()
        return Response.json({ ok: true, data: { taskId: TASK } })
      }
      if (url.pathname.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({
            state: "failed",
            errorCode: "BUDGET_EXCEEDED",
          }),
        })
      const response = await chatApiFetchOrThrow(input, init)
      if (url.pathname === `/api/chats/${CHAT}`) {
        const body = (await response.json()) as {
          data: Record<string, unknown>
        }
        return Response.json({
          ok: true,
          data: { ...body.data, activeTaskId: TASK },
        })
      }
      return response
    }
  )
  const hook = mount(CHAT)
  await waitFor(() =>
    expect(hook.result.current.error).toBe(
      "The Coach hit its limit for this turn."
    )
  )
  expect(hook.result.current.limitReached).toBe(true)
  act(() => {
    expect(hook.result.current.retry()).toBe(false)
  })
  expect(starts).not.toHaveBeenCalled()
  hook.unmount()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

it("keeps Stop during Chat creation and never sends the pending start", async () => {
  const creation = deferred<void>()
  const creating = vi.fn()
  const starts = vi.fn(() =>
    Response.json({ ok: true, data: { taskId: TASK } })
  )
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith("chat.create")) {
        creating()
        await creation.promise
      }
      if (path.endsWith("coach.start")) return starts()
      if (path.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({ state: "succeeded" }),
        })
      return chatApiFetchOrThrow(input, init)
    }
  )
  const hook = mount()
  act(() => {
    expect(hook.result.current.send("Stop before creating")).toBe(true)
  })
  await waitFor(() => expect(creating).toHaveBeenCalledOnce())
  act(() => hook.result.current.stop())
  await act(async () => creation.resolve())
  await waitFor(() => expect(hook.result.current.progress.active).toBe(false))
  expect(starts).not.toHaveBeenCalled()
  expect(hook.result.current.error).toBe("The Coach stopped.")
  expect(chatCreateCalls()).toHaveLength(1)
  hook.unmount()
})

it.each([false, true])(
  "durably stops an accepted start after a delayed response, lost response: %s",
  async (lostResponse) => {
    setMockChats([{ id: CHAT, title: "Pending Chat" }])
    const acceptance = deferred<void>()
    const inputs: Array<Record<string, unknown>> = []
    const stops: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname
        const commandInput = () =>
          (JSON.parse(String(init?.body)) as { input: Record<string, unknown> })
            .input
        if (path.endsWith("coach.start")) {
          inputs.push(commandInput())
          if (inputs.length === 1) {
            await acceptance.promise
            if (lostResponse) throw new Error("accepted response lost")
          }
          return Response.json({ ok: true, data: { taskId: TASK } })
        }
        if (path.endsWith("coach.stop")) {
          stops.push(commandInput())
          return Response.json({ ok: true, data: { stopped: true } })
        }
        if (path.includes("/coach/tasks/"))
          return Response.json({
            ok: true,
            data: taskSnapshot({ state: "cancelled" }),
          })
        return chatApiFetchOrThrow(input, init)
      }
    )
    const hook = mount(CHAT)
    act(() => {
      expect(hook.result.current.send("Stop accepted work")).toBe(true)
    })
    await waitFor(() => expect(inputs).toHaveLength(1))
    act(() => hook.result.current.stop())
    expect(stops).toHaveLength(0)
    await act(async () => acceptance.resolve())
    await waitFor(() => expect(stops).toEqual([{ chatId: CHAT, taskId: TASK }]))
    await waitFor(() => expect(hook.result.current.progress.active).toBe(false))
    expect(inputs).toHaveLength(lostResponse ? 2 : 1)
    if (lostResponse) expect(inputs[1]).toEqual(inputs[0])
    expect(hook.result.current.error).toBe("The Coach stopped.")
    hook.unmount()
  }
)

it("releases a detached start without letting stale completion clear the newer lock or state", async () => {
  const other = "01900000-0000-7000-8000-000000000003"
  setMockChats([
    { id: CHAT, title: "Old Chat" },
    { id: other, title: "New Chat" },
  ])
  const oldStart = deferred<void>()
  const newStart = deferred<void>()
  const inputs: Array<Record<string, unknown>> = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith("coach.start")) {
        const body = (
          JSON.parse(String(init?.body)) as { input: Record<string, unknown> }
        ).input
        inputs.push(body)
        await (body.chatId === CHAT ? oldStart.promise : newStart.promise)
        return Response.json({ ok: true, data: { taskId: TASK } })
      }
      if (path.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({
            chatId: parseChatId(other),
            state: "succeeded",
          }),
        })
      return chatApiFetchOrThrow(input, init)
    }
  )
  const hook = mount(CHAT)
  act(() => {
    expect(hook.result.current.send("Old request")).toBe(true)
  })
  await waitFor(() => expect(inputs).toHaveLength(1))
  act(() => hook.result.current.switchChat(other))
  expect(hook.result.current.phase).toBe("idle")
  const send = hook.result.current.send
  act(() => {
    expect(send("New request")).toBe(true)
  })
  await waitFor(() => expect(inputs).toHaveLength(2))
  await act(async () => oldStart.resolve())
  expect(hook.result.current.phase).toBe("waiting")
  expect(hook.result.current.messages).toEqual([])
  act(() => {
    expect(send("Duplicate while new request is pending")).toBe(false)
  })
  expect(inputs).toHaveLength(2)
  await act(async () => newStart.resolve())
  await waitFor(() => expect(hook.result.current.phase).toBe("idle"))
  expect(inputs.map((input) => input.chatId)).toEqual([CHAT, other])
  hook.unmount()
})

const NEW_TASK = "01900000-0000-7000-8000-000000000004"

it.each([false, true])(
  "recovers a lost start with its key before Stop despite a refreshed active Chat, StrictMode: %s",
  async (strict) => {
    setMockChats([{ id: CHAT, title: "Lost start" }])
    const inputs: Array<Record<string, unknown>> = []
    const stops: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname
        const body = () =>
          (JSON.parse(String(init?.body)) as { input: Record<string, unknown> })
            .input
        if (path.endsWith("coach.start")) {
          inputs.push(body())
          if (inputs.length === 1) throw new Error("accepted response lost")
          return Response.json({ ok: true, data: { taskId: TASK } })
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
        return chatApiFetchOrThrow(input, init)
      }
    )
    const hook = mount(CHAT, strict)
    act(() => {
      expect(hook.result.current.send("Recover exact work")).toBe(true)
    })
    await waitFor(() => expect(hook.result.current.error).toBeTruthy())
    act(() => {
      hook.client.setQueryData(["chat.get", { chatId: CHAT }], {
        id: CHAT,
        messages: [],
        activeTaskId: TASK,
      })
    })
    act(() => {
      hook.result.current.stop()
      hook.result.current.stop()
    })
    await waitFor(() => expect(stops).toEqual([{ chatId: CHAT, taskId: TASK }]))
    expect(inputs).toHaveLength(2)
    expect(inputs[1]).toEqual(inputs[0])
    hook.unmount()
    hook.client.clear()
  }
)

it("fulfills the original Stop after detach without stopping the newer turn", async () => {
  setMockChats([{ id: CHAT, title: "Reopened" }])
  const recovery = deferred<void>()
  const inputs: Array<Record<string, unknown>> = []
  const stops: Array<Record<string, unknown>> = []
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      const body = () =>
        (JSON.parse(String(init?.body)) as { input: Record<string, unknown> })
          .input
      if (path.endsWith("coach.start")) {
        inputs.push(body())
        const attempt = inputs.length
        if (attempt === 1) throw new Error("accepted response lost")
        if (attempt === 2) await recovery.promise
        return Response.json({
          ok: true,
          data: { taskId: attempt === 2 ? TASK : NEW_TASK },
        })
      }
      if (path.endsWith("coach.stop")) {
        stops.push(body())
        return Response.json({ ok: true, data: { stopped: true } })
      }
      if (path.includes("/coach/tasks/"))
        return Response.json({
          ok: true,
          data: taskSnapshot({ taskId: NEW_TASK }),
        })
      return chatApiFetchOrThrow(input, init)
    }
  )
  const hook = mount(CHAT)
  act(() => {
    hook.result.current.send("Original")
  })
  await waitFor(() => expect(hook.result.current.error).toBeTruthy())
  act(() => {
    hook.result.current.stop()
  })
  await waitFor(() => expect(inputs).toHaveLength(2))
  act(() => {
    hook.result.current.switchChat(CHAT)
  })
  act(() => {
    expect(hook.result.current.send("Newer")).toBe(true)
  })
  await waitFor(() => expect(inputs).toHaveLength(3))
  await act(async () => recovery.resolve())
  expect(stops).toEqual([{ chatId: CHAT, taskId: TASK }])
  expect(hook.result.current.progress.active).toBe(true)
  hook.unmount()
  hook.client.clear()
})

it.each([false, true])(
  "deduplicates Stop and ignores Stop after terminal, StrictMode: %s",
  async (strict) => {
    setMockChats([{ id: CHAT, title: "Running" }])
    const stopped = deferred<void>()
    const stops: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname
        if (path.endsWith("coach.start"))
          return Response.json({ ok: true, data: { taskId: TASK } })
        if (path.endsWith("coach.stop")) {
          stops.push(
            (
              JSON.parse(String(init?.body)) as {
                input: Record<string, unknown>
              }
            ).input
          )
          stopped.resolve()
          return Response.json({ ok: true, data: { stopped: true } })
        }
        if (path.includes("/coach/tasks/")) {
          await stopped.promise
          return Response.json({
            ok: true,
            data: taskSnapshot({ state: "cancelled" }),
          })
        }
        return chatApiFetchOrThrow(input, init)
      }
    )
    const hook = mount(CHAT, strict)
    act(() => {
      hook.result.current.send("Stop once")
    })
    await waitFor(() => expect(hook.result.current.phase).toBe("waiting"))
    await act(async () => {})
    act(() => {
      hook.result.current.stop()
      hook.result.current.stop()
    })
    await waitFor(() => expect(hook.result.current.progress.active).toBe(false))
    act(() => {
      hook.result.current.stop()
    })
    expect(stops).toEqual([{ chatId: CHAT, taskId: TASK }])
    hook.unmount()
    hook.client.clear()
  }
)

it.each([false, true])(
  "cancels before dispatch in an existing Chat without ever sending start, StrictMode: %s",
  async (strict) => {
    setMockChats([{ id: CHAT, title: "Immediate Stop" }])
    const starts = vi.fn(() =>
      Response.json({ ok: true, data: { taskId: TASK } })
    )
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (new URL(String(input)).pathname.endsWith("coach.start"))
          return starts()
        return chatApiFetchOrThrow(input, init)
      }
    )
    const hook = mount(CHAT, strict)
    act(() => {
      hook.result.current.send("Cancel before dispatch")
      hook.result.current.stop()
    })
    await act(async () => {})
    expect(starts).not.toHaveBeenCalled()
    expect(hook.result.current.phase).toBe("idle")
    expect(hook.result.current.error).toBe("The Coach stopped.")
    hook.unmount()
    hook.client.clear()
  }
)
