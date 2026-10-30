import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { createElement, useReducer, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { installChatApiMock, scriptCoachStream } from "@/test/chat-api-mock.ts"
import { call, liveTurn, result, step } from "@/test/live-turn.ts"

import type { CoachProgressRow } from "./coach-progress.ts"
import { useCoachTurn } from "./use-coach-turn.ts"

function chatIdReducer(
  _chatId: string | null,
  action: { type: "active_chat_opened"; id: string }
) {
  return action.id
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  const hook = renderHook(
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
  const turn = liveTurn()
  const feed = async (...events: { event: string; data: unknown }[]) => {
    for (const { event, data } of events) {
      await act(async () => {
        turn.emit(event, data)
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }
  }
  const statuses = () =>
    hook.result.current.progress.rows.map(
      (row: CoachProgressRow) => `${row.label}:${row.status}`
    )
  const start = async () => {
    act(() => {
      hook.result.current.send("Go")
    })
    await feed({ event: "message-start", data: { chatId: "c" } })
  }
  return { hook, turn, feed, statuses, start }
}

describe("Coach Working progress from real stream events", () => {
  beforeEach(() => {
    installChatApiMock()
    scriptCoachStream({})
  })
  afterEach(() => vi.unstubAllGlobals())

  it("keeps concurrent calls running until each one's own result", async () => {
    const { feed, statuses, start } = setup()
    await start()
    await feed(
      step("List documents"),
      call("a", "paper.get"),
      step("List jobs"),
      call("b", "job.list")
    )
    expect(statuses()).toEqual(["List documents:running", "List jobs:running"])
    await feed(result("b", "job.list"))
    expect(statuses()).toEqual([
      "List documents:running",
      "List jobs:completed",
    ])
    await feed(result("a", "paper.get"))
    expect(statuses()).toEqual([
      "List documents:completed",
      "List jobs:completed",
    ])
  })

  it("shows repeated labels as separate rows with their own status", async () => {
    const { feed, statuses, start } = setup()
    await start()
    await feed(
      step("Read document"),
      call("c1", "paper.get"),
      step("Read document"),
      call("c2", "paper.get"),
      result("c2", "paper.get")
    )
    expect(statuses()).toEqual([
      "Read document:running",
      "Read document:completed",
    ])
  })

  it("holds a pending command at awaiting confirmation before confirm arrives", async () => {
    const { hook, feed, statuses, start } = setup()
    await start()
    await feed(
      step("Move card"),
      call("m", "job.move"),
      result("m", "job.move", { pendingActionId: "pending-1" })
    )
    // No confirm event has been delivered yet.
    expect(statuses()).toEqual(["Move card:approval"])
    await feed({
      event: "confirm",
      data: {
        pendingActionId: "pending-1",
        command: "job.move",
        summary: "Move card",
      },
    })
    expect(statuses()).toEqual(["Move card:approval"])
    expect(hook.result.current.progress.active).toBe(true)
  })

  it("marks a failed result failed and leaves its sibling running", async () => {
    const { feed, statuses, start } = setup()
    await start()
    await feed(
      step("Read document"),
      call("a", "paper.get"),
      step("List jobs"),
      call("b", "job.list"),
      result("a", "paper.get", {
        ok: false,
        result: { ok: false, error: { code: "NOT_FOUND", message: "Gone" } },
      })
    )
    expect(statuses()).toEqual(["Read document:failed", "List jobs:running"])
  })

  it("shows an uncorrelated step as reported, with no count or queued row", async () => {
    const { feed, statuses, start } = setup()
    await start()
    await feed(step("Checking your inbox"))
    expect(statuses()).toEqual(["Checking your inbox:reported"])
  })

  it("settles inactive once the turn ends", async () => {
    const { hook, turn, feed, start } = setup()
    await start()
    await feed(step("Read"), call("a", "paper.get"), result("a", "paper.get"))
    await feed({ event: "message-end", data: { chatId: "c" } })
    await act(async () => {
      turn.close()
    })
    await waitFor(() => expect(hook.result.current.progress.active).toBe(false))
  })
})
