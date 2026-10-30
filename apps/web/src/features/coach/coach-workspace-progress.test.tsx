import { act, cleanup, fireEvent, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { installChatApiMock, scriptCoachStream } from "@/test/chat-api-mock.ts"
import { call, liveTurn, result, step } from "@/test/live-turn.ts"
import { profileApiFetch } from "@/test/profile-api-mock.ts"
import { render } from "@/test/render-with-client.tsx"

import { ChatStoreProvider } from "./chat-store.tsx"
import { CoachWorkspace } from "./coach-workspace.tsx"

vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<object>()),
  useNavigate: () => vi.fn(),
}))

beforeEach(() => {
  installChatApiMock()
  scriptCoachStream({})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function openTurn() {
  // Profile reads still go to their mock; the chat mock is wrapped by liveTurn.
  const turn = liveTurn()
  const liveFetch = globalThis.fetch
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) =>
      (await profileApiFetch(input, init)) ?? liveFetch(input, init)
  )
  const view = render(
    <ChatStoreProvider>
      <CoachWorkspace />
    </ChatStoreProvider>
  )
  const box = await screen.findByRole("textbox", { name: "Message Coach" })
  fireEvent.change(box, { target: { value: "Check my week" } })
  fireEvent.click(screen.getByRole("button", { name: "Send" }))
  const feed = async (event: string, data: unknown) => {
    await act(async () => {
      turn.emit(event, data)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
  await feed("message-start", { chatId: "c" })
  const rowStatuses = () =>
    [
      ...view.container.querySelectorAll("[data-slot='coach-progress-row']"),
    ].map((row) => row.getAttribute("data-status"))
  const working = () =>
    view.container.querySelector("[data-slot='coach-working']")
  return { view, feed, rowStatuses, working }
}

describe("Coach workspace shows streamed progress", () => {
  it("renders real streamed calls as Working rows, once, with no composer step text", async () => {
    const { view, feed, rowStatuses, working } = await openTurn()
    const a = step("List documents")
    const b = step("List jobs")
    await feed(a.event, a.data)
    await feed(call("a", "paper.get").event, call("a", "paper.get").data)
    await feed(b.event, b.data)
    await feed(call("b", "job.list").event, call("b", "job.list").data)
    const done = result("b", "job.list")
    await feed(done.event, done.data)
    await flush()

    expect(rowStatuses()).toEqual(["running", "completed"])
    // Each label is on screen once: the old composer-side step text is gone.
    expect(screen.getAllByText("List documents")).toHaveLength(1)
    expect(screen.getAllByText("List jobs")).toHaveLength(1)
    // The tool-only result keeps Working visible; its live status omits seconds.
    expect(working()).not.toBeNull()
    expect(
      within(working() as HTMLElement)
        .getAllByRole("status")
        .map((node) => node.textContent)
    ).toEqual(["Working"])
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
    expect(
      view.container.querySelectorAll("[data-slot='coach-working']")
    ).toHaveLength(1)
  })

  it("keeps a running call visible when the Coach wrote text first, then follows its result", async () => {
    const { feed, rowStatuses, working } = await openTurn()
    await feed("text-delta", { text: "Let me check your jobs." })
    const s = step("List jobs")
    await feed(s.event, s.data)
    await feed(call("b", "job.list").event, call("b", "job.list").data)
    await flush()

    expect(screen.getByText("Let me check your jobs.")).toBeInTheDocument()
    // Text arrived first, so there is no Working header or timer, only the row.
    expect(rowStatuses()).toEqual(["running"])
    expect(screen.getAllByText("List jobs")).toHaveLength(1)
    expect(screen.queryByText(/Working, \d+s/)).toBeNull()
    expect(working()).not.toBeNull()

    const done = result("b", "job.list")
    await feed(done.event, done.data)
    await flush()
    // Once nothing is running, the receipt carries the result and the rows go.
    expect(rowStatuses()).toEqual([])
    expect(working()).toBeNull()
  })

  it("shows a pending action once, on its card with Approve and Deny, without a Working timer", async () => {
    const { feed, rowStatuses, working } = await openTurn()
    const s = step("Move card")
    await feed(s.event, s.data)
    await feed(call("m", "job.move").event, call("m", "job.move").data)
    const pending = result("m", "job.move", { pendingActionId: "pending-1" })
    await feed(pending.event, pending.data)
    await flush()

    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Deny" })).toBeEnabled()
    expect(
      screen.getAllByText("Review this action before it runs.")
    ).toHaveLength(1)
    // The card already says the action waits, so no row, no Working header.
    expect(rowStatuses()).toEqual([])
    expect(screen.queryByText(/Working, \d+s/)).toBeNull()
    expect(working()).toBeNull()
  })
})
