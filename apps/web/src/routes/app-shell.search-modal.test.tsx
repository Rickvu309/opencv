import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { HOME_PATH, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { FIXTURE_THREADS } from "@/test/thread-fixtures.ts"
import { expectHomeIdle } from "@/test/home-helpers.ts"
import { renderApp } from "@/test/render-app.tsx"

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

async function openSearch() {
  fireEvent.keyDown(window, { key: "k", metaKey: true })
  expect(
    await screen.findByRole("dialog", { name: "Search" })
  ).toBeInTheDocument()
}

describe("search modal", () => {
  it("opens from ⌘K and closes on Escape", async () => {
    renderApp(HOME_PATH)
    await expectHomeIdle()
    await openSearch()

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search" })
      ).not.toBeInTheDocument()
    })
  })

  it("opens from Ctrl+K and from Meta+K", async () => {
    renderApp(HOME_PATH)
    await expectHomeIdle()

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search" })
      ).not.toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: "k", metaKey: true })
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()
  })

  it("jumps surfaces and starts a new Thread", async () => {
    const { router } = renderApp(HOME_PATH)
    await expectHomeIdle()
    await openSearch()

    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "paper" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Open Paper" }))
    await expectPaperDrive()
    expect(
      screen.queryByRole("dialog", { name: "Search" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })

    await openSearch()
    fireEvent.click(screen.getByRole("button", { name: "Start a new Thread" }))
    await expectHomeIdle()
    expect(
      screen.queryByRole("dialog", { name: "Search" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(HOME_PATH)
    })
  })

  it("filters Thread titles from the list port", async () => {
    renderApp(HOME_PATH)
    await expectHomeIdle()
    await openSearch()

    const dialog = screen.getByRole("dialog", { name: "Search" })
    expect(within(dialog).getByText("Recent")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Resize" })
    ).not.toBeInTheDocument()
    expect(
      await within(dialog).findByRole("button", {
        name: /CV vs internship first/,
      })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: /Checkout study/ })
    ).toBeInTheDocument()

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "checkout" },
    })

    expect(
      within(dialog).getByRole("button", { name: /Checkout study/ })
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: /CV vs internship first/ })
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: /Is this role a fit/ })
    ).not.toBeInTheDocument()

    const other = FIXTURE_THREADS.find((t) => !/checkout/i.test(t.title))
    expect(other).toBeTruthy()
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "zzzz-no-thread" },
    })
    expect(within(dialog).getByText("No conversations")).toBeInTheDocument()
  })

  it("opens a History Thread from Search and returns to idle on new Thread", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()
    await openSearch()

    const dialog = screen.getByRole("dialog", { name: "Search" })
    fireEvent.click(
      await within(dialog).findByRole("button", {
        name: /CV vs internship first/,
      })
    )
    fireEvent.click(within(dialog).getByRole("button", { name: "Open Thread" }))

    expect(
      await screen.findByRole("log", { name: "Thread" })
    ).toBeInTheDocument()
    expect(
      await screen.findByText(FIXTURE_THREADS[0]!.messages[0]!.text)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: "Search" })
    ).not.toBeInTheDocument()

    await openSearch()
    fireEvent.click(screen.getByRole("button", { name: "Start a new Thread" }))
    await expectHomeIdle()
    expect(
      screen.queryByRole("log", { name: "Thread" })
    ).not.toBeInTheDocument()
  })

  it("moves keyboard highlight with arrows and keeps the Thread preview sticky", async () => {
    renderApp(HOME_PATH)
    await expectHomeIdle()
    await openSearch()

    const input = screen.getByRole("textbox", { name: "Search" })
    expect(input).toHaveAttribute("aria-activedescendant", "search-item-a1")
    expect(
      screen.getByText("Select a conversation to preview")
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: /CV vs internship first/ })
    ).toBeInTheDocument()

    for (let step = 0; step < 4; step++) {
      fireEvent.keyDown(input, { key: "ArrowDown" })
    }
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      `search-item-${FIXTURE_THREADS[0]!.id}`
    )
    expect(
      screen.getByRole("button", { name: "Open Thread" })
    ).toBeInTheDocument()

    for (let step = 0; step < 4; step++) {
      fireEvent.keyDown(input, { key: "ArrowUp" })
    }
    expect(input).toHaveAttribute("aria-activedescendant", "search-item-a1")
    expect(
      screen.getByRole("button", { name: "Open Thread" })
    ).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "checkout" } })
    const checkout = FIXTURE_THREADS.find((thread) =>
      /checkout/i.test(thread.title)
    )
    expect(checkout).toBeTruthy()
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      `search-item-${checkout!.id}`
    )
    expect(
      screen.getByRole("button", { name: /Checkout study/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Open Thread" })
    ).toBeInTheDocument()
  })

  it("activates a filtered action with Enter", async () => {
    const { router } = renderApp(HOME_PATH)
    await expectHomeIdle()
    await openSearch()

    const input = screen.getByRole("textbox", { name: "Search" })
    fireEvent.change(input, { target: { value: "paper" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await expectPaperDrive()
    expect(
      screen.queryByRole("dialog", { name: "Search" })
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.paper)
    })
  })

  it("toggles closed when ⌘K is pressed again", async () => {
    renderApp(HOME_PATH)
    await expectHomeIdle()

    fireEvent.keyDown(window, { key: "k", metaKey: true })
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "k", metaKey: true })
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search" })
      ).not.toBeInTheDocument()
    })
  })
})
