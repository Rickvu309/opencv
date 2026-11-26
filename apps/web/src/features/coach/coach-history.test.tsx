import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ChatSummary } from "@workspace/domain/coach"

import { CoachHistory } from "./coach-history.tsx"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectCoachIdle,
  expectSendSettled,
  sendMessage,
} from "@/test/coach-chat-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Coach history", () => {
  it("opens the history popover when the trigger is clicked", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    const trigger = screen.getByRole("button", { name: "History, Chats" })
    expect(trigger).toHaveAttribute("data-slot", "coach-history-trigger")
    fireEvent.click(trigger)
    expect(
      await screen.findByRole("textbox", { name: "Search chat history" })
    ).toBeInTheDocument()
    const search = screen.getByRole("textbox", {
      name: "Search chat history",
    })
    expect(search.className).toContain("text-base")
  })

  it("shows New chat and shortcut in the history popover", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    fireEvent.click(screen.getByRole("button", { name: "History, Chats" }))
    await screen.findByRole("textbox", { name: "Search chat history" })
    expect(screen.getAllByText("New chat").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("⌘ N")).toBeInTheDocument()
  })

  it("closes the popover when New chat is clicked and starts a fresh chat", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Should I finish my CV first?")
    await expectSendSettled("Should I finish my CV first?")
    fireEvent.click(screen.getByRole("button", { name: /History,/i }))
    await screen.findByRole("textbox", { name: "Search chat history" })
    fireEvent.click(screen.getByText("New chat"))
    expect(
      screen.queryByRole("textbox", { name: "Search chat history" })
    ).not.toBeInTheDocument()
    await screen.findByText("How can I help?")
  })

  it("keeps the open chat after visiting Paper", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Should I finish my CV first?")
    await expectSendSettled("Should I finish my CV first?")

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectPaperDrive()
    fireEvent.click(screen.getByRole("link", { name: "Coach" }))

    expect(await screen.findByRole("log", { name: "Chat" })).toHaveTextContent(
      "Should I finish my CV first?"
    )
  })
})

function renderHistory(chats: ChatSummary[], search: string) {
  const onSearchChange = vi.fn()
  render(
    <CoachHistory
      open
      onOpenChange={vi.fn()}
      headerTitle="New chat"
      chats={chats}
      activeChatId={null}
      search={search}
      onSearchChange={onSearchChange}
      onSelect={vi.fn()}
      onNewChat={vi.fn()}
    />
  )
  return onSearchChange
}

const SAVED: ChatSummary = {
  id: "chat-1",
  title: "Plan my week",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  focusDocId: null,
}

describe("Coach history states", () => {
  it("says there are no chats yet when history is empty", async () => {
    renderHistory([], "")
    expect(
      await screen.findByText(
        "No chats yet. Your Chats with Coach appear here."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull()
  })

  it("names the search with no match and clears it", async () => {
    const onSearchChange = renderHistory([SAVED], "zzz")
    expect(await screen.findByText("No chats match “zzz”.")).toBeInTheDocument()
    expect(screen.queryByText(/No chats yet/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(onSearchChange).toHaveBeenLastCalledWith("")
    expect(
      screen.getByRole("textbox", { name: "Search chat history" })
    ).toHaveFocus()
  })

  it("clears a search on Escape before it closes", async () => {
    const onSearchChange = renderHistory([SAVED], "zzz")
    fireEvent.keyDown(
      await screen.findByRole("textbox", { name: "Search chat history" }),
      { key: "Escape" }
    )
    expect(onSearchChange).toHaveBeenLastCalledWith("")
  })
})
