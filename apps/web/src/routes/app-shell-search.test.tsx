import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { expectHomeIdle } from "@/test/home-helpers.ts"
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
    renderApp()
    await expectHomeIdle()

    const nav = screen.getByRole("navigation", { name: "Surfaces" })
    const search = within(nav).getByRole("button", { name: "Search" })
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
    renderApp()
    await expectHomeIdle()

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const dialog = await screen.findByRole("dialog")

    for (const label of [
      "Start a new Thread",
      "Open Paper",
      "Open Apply",
      "Open Pitch",
    ]) {
      expect(
        within(dialog).getByRole("button", { name: label })
      ).toBeInTheDocument()
    }
    expect(
      within(dialog).queryByRole("button", { name: /show all/i })
    ).not.toBeInTheDocument()
  })

  it("does not paint an always-on status mark on Apply", async () => {
    renderApp()
    await expectHomeIdle()

    const nav = screen.getByRole("navigation", { name: "Surfaces" })
    const apply = within(nav).getByRole("link", { name: "Apply" })
    expect(apply).toHaveTextContent(/^Apply$/)
    expect(apply.querySelector("[aria-hidden]:not(svg)")).toBeNull()
  })
})
