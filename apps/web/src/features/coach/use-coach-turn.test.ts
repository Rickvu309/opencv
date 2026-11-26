import { chatDetailSchema } from "@workspace/domain/coach"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createElement, useReducer, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { STREAMING_COACH_ID } from "@/features/coach/chat-messages.ts"
import {
  installChatApiMock,
  chatApiFetchOrThrow,
  scriptCoachStream,
} from "@/test/chat-api-mock.ts"

import { useCoachTurn } from "./use-coach-turn.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const webSrc = path.join(here, "../..")

function chatIdReducer(
  _chatId: string | null,
  action: { type: "active_chat_opened"; id: string }
) {
  return action.id
}

function read(rel: string) {
  return readFileSync(path.join(webSrc, rel), "utf8")
}

describe("shared Coach turn hook", () => {
  it("is the only turn implementation; Paper no longer has a private coach hook", () => {
    expect(
      existsSync(path.join(webSrc, "features/paper/use-paper-coach.ts"))
    ).toBe(false)
    expect(
      existsSync(path.join(webSrc, "features/paper/paper-ai-chat.tsx"))
    ).toBe(false)
    expect(
      existsSync(path.join(webSrc, "features/paper/coach-thread-panel.tsx"))
    ).toBe(false)

    const hook = read("features/coach/use-coach-turn.ts")
    expect(hook).toMatch(/export function useCoachTurn/)
    expect(hook).toMatch(/getChatByFocusDoc/)
    expect(hook).toMatch(/focusDocId/)
    expect(hook).not.toMatch(/sessionStorage/)
    expect(hook).not.toMatch(/paperCoach(Thread|Chat)StorageKey/)

    const store = read("features/coach/chat-store.tsx")
    expect(store).toMatch(/useCoachTurn/)
    expect(store).not.toMatch(/streamCoachTurn/)

    expect(
      existsSync(path.join(webSrc, "features/paper/coach-float.tsx"))
    ).toBe(false)
    expect(
      existsSync(path.join(webSrc, "features/paper/coach-float-chips.tsx"))
    ).toBe(false)
    expect(
      existsSync(path.join(webSrc, "features/paper/paper-cite-control.tsx"))
    ).toBe(false)

    expect(read("features/coach/coach-dock.tsx")).toMatch(/onAttachFromPaper/)
  })
})

describe("useCoachTurn turn lifecycle", () => {
  beforeEach(() => installChatApiMock())
  afterEach(() => vi.unstubAllGlobals())

  it.each([false, true])(
    "retains one aborted reply and regenerates with delayed persistence %s",
    async (delayed) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      queryClient.setQueryData(["coach-config"], { coachDurable: false })
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
      const { result } = renderHook(
        () => {
          const [chatId, dispatch] = useReducer(chatIdReducer, null)
          return useCoachTurn({
            chatId,
            setChatId: (id) => dispatch({ type: "active_chat_opened", id }),
            titleForCreate: (text) => text,
          })
        },
        { wrapper }
      )
      const coachTexts = () =>
        result.current.messages
          .filter((message) => message.role === "coach")
          .map((message) => message.text)

      const stream = scriptCoachStream({
        gated: true,
        texts: ["Partial reply", " never shown"],
      })
      act(() => {
        result.current.send("Stop me")
      })
      expect(result.current.phase).toBe("waiting")
      stream.release(2)
      await waitFor(() => expect(result.current.phase).toBe("streaming"))

      if (delayed) {
        let hideReply = true
        vi.stubGlobal(
          "fetch",
          async (input: RequestInfo | URL, init?: RequestInit) => {
            const response = await chatApiFetchOrThrow(input, init)
            const url = typeof input === "string" ? input : String(input)
            if (
              hideReply &&
              (init?.method ?? "GET") === "GET" &&
              /\/api\/chats\/[^/?]+$/.test(new URL(url, "http://x").pathname)
            ) {
              hideReply = false
              const envelope: { data: unknown } = await response.json()
              const detail = chatDetailSchema.parse(envelope.data)
              return Response.json({
                ok: true,
                data: {
                  ...detail,
                  messages: detail.messages.filter(
                    (message) => message.role !== "coach"
                  ),
                },
              })
            }
            return response
          }
        )
      }
      act(() => result.current.stop())
      await waitFor(() => expect(result.current.phase).toBe("idle"))
      expect(coachTexts()).toEqual(["Partial reply"])
      expect(result.current.error).toBeNull()

      if (delayed) {
        const second = scriptCoachStream({
          gated: true,
          texts: ["Second partial", " never shown"],
        })
        act(() => {
          result.current.regenerate()
        })
        second.release(2)
        await waitFor(() => expect(coachTexts()).toEqual(["Second partial"]))
        let hideSecondReply = true
        vi.stubGlobal(
          "fetch",
          async (input: RequestInfo | URL, init?: RequestInit) => {
            const response = await chatApiFetchOrThrow(input, init)
            const url = typeof input === "string" ? input : String(input)
            if (
              hideSecondReply &&
              (init?.method ?? "GET") === "GET" &&
              /\/api\/chats\/[^/?]+$/.test(new URL(url, "http://x").pathname)
            ) {
              hideSecondReply = false
              const envelope: { data: unknown } = await response.json()
              const detail = chatDetailSchema.parse(envelope.data)
              return Response.json({
                ok: true,
                data: { ...detail, messages: detail.messages.slice(0, -1) },
              })
            }
            return response
          }
        )
        act(() => result.current.stop())
        await waitFor(() => expect(result.current.phase).toBe("idle"))
        expect(coachTexts()).toEqual(["Second partial"])
      }

      scriptCoachStream({ texts: ["Fresh reply"] })
      act(() => {
        result.current.regenerate()
      })
      await waitFor(() => expect(coachTexts()).toContain("Fresh reply"))
      await waitFor(() => expect(result.current.phase).toBe("idle"))
      expect(coachTexts()).toEqual(["Fresh reply"])
      const ids = result.current.messages.map((message) => message.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).not.toContain(STREAMING_COACH_ID)
    }
  )

  it("keeps the streamed reply on screen when re-reading the chat fails", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(["coach-config"], { coachDurable: false })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const { result } = renderHook(
      () => {
        const [chatId, dispatch] = useReducer(chatIdReducer, null)
        return useCoachTurn({
          chatId,
          setChatId: (id) => dispatch({ type: "active_chat_opened", id }),
          titleForCreate: (text) => text,
        })
      },
      { wrapper }
    )
    scriptCoachStream({ texts: ["Kept reply"] })
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : String(input)
        if (
          (init?.method ?? "GET").toUpperCase() === "GET" &&
          /\/api\/chats\/[^/?]+$/.test(new URL(url, "http://x").pathname)
        ) {
          return new Response("{}", { status: 500 })
        }
        return chatApiFetchOrThrow(input, init)
      }
    )
    act(() => {
      result.current.send("Hello")
    })
    await waitFor(() => expect(result.current.phase).toBe("idle"))
    const texts = result.current.messages.map((message) => message.text)
    expect(texts).toContain("Hello")
    expect(texts).toContain("Kept reply")
  })
})
