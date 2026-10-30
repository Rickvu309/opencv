import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

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
    const trigger = screen.getByRole("button", { name: "History, New chat" })
    expect(trigger).toHaveAttribute("data-slot", "coach-history-trigger")
    fireEvent.click(trigger)
    expect(
      await screen.findByRole("textbox", { name: "Search chat history" })
    ).toBeInTheDocument()
  })

  it("shows New chat and shortcut in the history popover", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    fireEvent.click(
      screen.getByRole("button", { name: "History, New chat" })
    )
    await screen.findByRole("textbox", { name: "Search chat history" })
    expect(screen.getAllByText("New chat").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("⌘ N")).toBeInTheDocument()
  })

  it("closes the popover when New chat is clicked and starts a fresh chat", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Should I finish my CV first?")
    await expectSendSettled("Should I finish my CV first?")
    fireEvent.click(
      screen.getByRole("button", { name: /History,/i })
    )
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
