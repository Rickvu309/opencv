import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { FIXTURE_CHATS } from "@/test/chat-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("App shell sidebar", () => {
  it("shows the Search shortcut and opens the same dialog as the key", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    const search = screen.getByRole("button", { name: "Search" })
    expect(within(search).getByText(/^(⌘K|Ctrl K)$/)).toBeInTheDocument()

    fireEvent.click(search)
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByRole("textbox", { name: "Search" })
    ).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("shows every first action in the dialog without a Show all step", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const dialog = await screen.findByRole("dialog")

    for (const label of ["Coach", "Apply", "Settings", "Help"]) {
      expect(
        within(dialog).getByRole("button", { name: label })
      ).toBeInTheDocument()
    }
    for (const label of ["Inbox", "Pitch"]) {
      expect(
        within(dialog).queryByRole("button", { name: label })
      ).not.toBeInTheDocument()
    }
    for (const label of ["Jobs", "Paper"]) {
      expect(
        within(dialog).getAllByRole("button", { name: label }).length
      ).toBeGreaterThan(0)
    }
    expect(
      within(dialog).queryByRole("button", { name: /show all/i })
    ).not.toBeInTheDocument()
  })

  it("does not paint an always-on status mark on Apply", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    const nav = screen.getByRole("navigation", { name: "Main" })
    const apply = within(nav).getByRole("link", { name: "Apply" })
    expect(apply).toHaveTextContent(/^Apply$/)
    expect(apply.querySelector("[aria-hidden]:not(svg)")).toBeNull()
  })

  it("opens a chosen chat in the Coach panel without leaving the page", async () => {
    const chat = FIXTURE_CHATS[0]!
    const { router } = renderApp(SURFACE_PATHS.apply)
    await screen.findByRole("heading", { level: 1, name: "Apply" })

    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    const dialog = await screen.findByRole("dialog", { name: "Search" })
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: new RegExp(chat.title),
      })
    )

    const panel = await screen.findByRole("region", {
      name: chat.title,
    })
    expect(
      await within(panel).findByRole("log", { name: "Chat" })
    ).toHaveTextContent(chat.messages[0]!.text)
    expect(router.state.location.pathname).toBe(SURFACE_PATHS.apply)
  })
})
