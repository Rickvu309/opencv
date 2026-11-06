import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createElement, useReducer, type ReactNode } from "react"
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

function mount(initialChatId: string | null = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const hook = renderHook(
    () => {
      const [chatId, setChatId] = useReducer(
        (_: string | null, next: string | null) => next,
        initialChatId
      )
      return useCoachTask(
        { chatId, setChatId, titleForCreate: (text) => text },
        true
      )
    },
    { wrapper }
  )
  return hook
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
