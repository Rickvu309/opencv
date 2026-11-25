import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  act,
  renderHook,
  waitFor,
  screen,
  within,
} from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { chatApiFetchOrThrow, setMockChats } from "@/test/chat-api-mock.ts"
import { CHAT, TASK, taskSnapshot } from "@/test/coach-task-fixture.ts"
import { useCoachTurn } from "./use-coach-turn.ts"
import { render } from "@/test/render-with-client.tsx"
import { CoachWorkspace } from "./coach-workspace.tsx"
import { ChatStoreContext, type ChatStoreValue } from "./chat-store-context.ts"

function mount(chatId: string | null = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const hook = renderHook(
    () =>
      useCoachTurn({ chatId, setChatId() {}, titleForCreate: (text) => text }),
    { wrapper }
  )
  return { ...hook, client }
}
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("bounds unknown config, shows loading then failure, and retries without admitting a reply", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  let ready = false
  let signal: AbortSignal | null | undefined
  const starts: string[] = []
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith("public-config")) {
      if (ready) return Promise.resolve(Response.json({ coachDurable: false }))
      signal = init?.signal
      return new Promise<Response>((_, reject) => {
        signal?.addEventListener("abort", () => reject(signal?.reason), {
          once: true,
        })
      })
    }
    if (path.endsWith("coach.start") || path.endsWith("turns"))
      starts.push(path)
    return chatApiFetchOrThrow(input, init)
  })
  const hook = mount()
  expect(hook.result.current.configuration).toBe("loading")
  act(() => {
    expect(hook.result.current.send("Keep my draft")).toBe(false)
  })
  expect(starts).toEqual([])
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5100)
  })
  expect(signal?.aborted).toBe(true)
  expect(hook.result.current.configuration).toBe("error")
  expect(hook.result.current.error).toContain("Retry")
  vi.useRealTimers()
  ready = true
  await act(async () => {
    expect(hook.result.current.retry()).toBe(true)
  })
  await waitFor(() => expect(hook.result.current.configuration).toBe("ready"))
  expect(starts).toEqual([])
  hook.unmount()
  hook.client.clear()
})

it("shows and stops an unfinished durable task while the server admits only legacy turns", async () => {
  setMockChats([{ id: CHAT, title: "Accepted reply" }])
  let terminal = false
  const stops: unknown[] = []
  let events: ReadableStreamDefaultController<Uint8Array> | undefined
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith("public-config"))
        return Response.json({ coachDurable: false })
      if (path.endsWith("/api/reads/chat.get")) {
        const response = await chatApiFetchOrThrow(input, init)
        const body = await response.json()
        return Response.json({
          ...body,
          data: { ...body.data, activeTaskId: terminal ? null : TASK },
        })
      }
      if (path.endsWith("coach.stop")) {
        stops.push(JSON.parse(String(init?.body)))
        terminal = true
        events?.enqueue(
          new TextEncoder().encode(
            "event: task\ndata: " +
              JSON.stringify({
                taskId: TASK,
                seq: 0,
                epoch: 1,
                attempt: 1,
                step: 0,
                kind: "state",
                payload: { state: "cancelled" },
                createdAt: new Date().toISOString(),
              }) +
              "\n\n"
          )
        )
        events?.close()
        return Response.json({ ok: true, data: { stopped: true } })
      }
      if (path.includes("/coach/tasks/") || path.endsWith("coach.status")) {
        if (path.endsWith("events"))
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                events = controller
              },
            })
          )
        return Response.json({
          ok: true,
          data: taskSnapshot({
            state: terminal ? "cancelled" : "waitingApproval",
          }),
        })
      }
      return chatApiFetchOrThrow(input, init)
    }
  )
  const hook = mount(CHAT)
  await waitFor(() => expect(hook.result.current.phase).not.toBe("idle"))
  expect(hook.result.current.send("Must wait")).toBe(false)
  act(() => hook.result.current.stop())
  await waitFor(() => expect(stops).toHaveLength(1))
  await waitFor(() => expect(hook.result.current.phase).toBe("idle"))
  hook.unmount()
  hook.client.clear()
})

it("renders the legacy tail completion notice without offering Retry", async () => {
  setMockChats([{ id: CHAT, title: "Old tab" }])
  let capped = false
  const notice =
    "Coach is still working. Reload this Chat to follow or stop it."
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith("public-config"))
        return Response.json({ coachDurable: false })
      if (path.endsWith("/turns")) {
        capped = true
        return new Response(
          `event: message-start\ndata: ${JSON.stringify({ chatId: CHAT })}\n\nevent: notice\ndata: ${JSON.stringify({ text: notice })}\n\nevent: message-end\ndata: ${JSON.stringify({ chatId: CHAT })}\n\n`
        )
      }
      const response = await chatApiFetchOrThrow(input, init)
      if (capped && path.endsWith("/api/reads/chat.get")) {
        const body = await response.json()
        return Response.json({
          ...body,
          data: {
            ...body.data,
            messages: [
              ...body.data.messages,
              {
                id: TASK,
                chatId: CHAT,
                role: "coach",
                text: notice,
                parts: [{ type: "text", text: notice }],
                status: null,
                workedMs: null,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        })
      }
      return response
    }
  )
  const hook = mount(CHAT)
  await waitFor(() => expect(hook.result.current.configuration).toBe("ready"))
  act(() => {
    expect(hook.result.current.send("Continue in the background")).toBe(true)
  })
  await waitFor(() => expect(hook.result.current.phase).toBe("idle"))
  expect(hook.result.current.error).toBeNull()
  expect(
    hook.result.current.messages.some((message) => message.text === notice)
  ).toBe(true)
  expect(hook.result.current.retry()).toBe(false)
  hook.unmount()
  hook.client.clear()
})

it.each(["loading", "error"] as const)(
  "keeps config %s visible beside the composer",
  async (configuration) => {
    const retry = vi.fn(() => true)
    const store: ChatStoreValue = {
      chats: [],
      chatsLoaded: true,
      activeChatId: null,
      navigationRevision: 0,
      creationOwner: null,
      messages: [],
      configuration,
      phase: "idle",
      progress: { active: false, rows: [] },
      error:
        configuration === "error"
          ? "Could not load Coach settings. Retry to reconnect."
          : null,
      send: () => false,
      stop() {},
      retry,
      regenerate: () => false,
      undo: async () => {},
      openChat() {},
      newChat() {},
      deleteChat: async () => {},
    }
    vi.stubGlobal("fetch", async () => Response.json({ ok: true, data: {} }))
    render(
      createElement(
        ChatStoreContext.Provider,
        { value: store },
        createElement(CoachWorkspace)
      )
    )
    const textbox = screen.getByRole("textbox", { name: "Message Coach" })
    const composer = textbox.closest('[data-slot="coach-workspace-composer"]')
    expect(textbox).toBeDisabled()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    if (configuration === "loading") {
      expect(composer).toContainElement(screen.getByRole("status"))
      expect(screen.getByText("Loading Coach settings…")).toBeVisible()
    } else {
      const alert = screen.getByRole("alert")
      expect(composer).toContainElement(alert)
      expect(alert).toHaveTextContent("Could not load Coach settings")
      await act(async () =>
        within(alert).getByRole("button", { name: "Retry" }).click()
      )
      expect(retry).toHaveBeenCalledOnce()
    }
  }
)
