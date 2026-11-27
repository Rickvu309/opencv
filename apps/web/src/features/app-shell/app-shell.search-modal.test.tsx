import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { FIXTURE_CHATS } from "@/test/chat-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  holdShellSearch,
  searchQueries,
  setMockChats,
  setMockSearch,
} from "@/test/shell-api-mock.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openSearch(path = "/apply") {
  renderApp(path)
  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: "Apply",
    })
  ).toBeInTheDocument()
  fireEvent.keyDown(window, { key: "k", ctrlKey: true })
  return screen.findByRole("dialog", { name: "Search" })
}

describe("command palette", () => {
  it("opens from Ctrl K and from Meta K", async () => {
    renderApp("/apply")
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Apply",
      })
    ).toBeInTheDocument()

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

  it("names the field, announces searching, and hides an empty footer", async () => {
    const release = holdShellSearch()
    try {
      const dialog = await openSearch()
      const input = within(dialog).getByRole("textbox", { name: "Search" })
      expect(input).toHaveAttribute(
        "placeholder",
        "Search jobs, Paper, and chats…"
      )
      expect(input.className).toContain("text-base")
      expect(dialog.className).toContain("overscroll-contain")
      expect(dialog.querySelector("#palette-results")?.className).toContain(
        "overscroll-contain"
      )
      fireEvent.change(input, { target: { value: "north" } })
      expect(await within(dialog).findByRole("status")).toHaveTextContent(
        "Searching…"
      )
      expect(
        dialog.querySelector("[data-slot='palette-properties']")
      ).toBeNull()
    } finally {
      release()
    }
  })

  it("does not echo a highlighted page in a footer", async () => {
    const dialog = await openSearch()
    const inbox = within(dialog).getByRole("button", { name: "Inbox" })
    expect(inbox).toHaveAttribute("aria-current", "true")
    expect(within(dialog).getAllByText("Inbox")).toHaveLength(1)
  })

  it("closes from a button that shows the Esc key", async () => {
    const dialog = await openSearch()
    const close = within(dialog).getByRole("button", { name: "Close search" })
    expect(within(close).getByText("Esc")).toBeInTheDocument()
    expect(within(close).queryByText("Close")).toBeNull()
    fireEvent.click(close)
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search" })
      ).not.toBeInTheDocument()
    })
  })

  it("lists pages for an empty query and does not call search", async () => {
    const dialog = await openSearch()
    expect(
      within(dialog).getByRole("button", { name: "Apply" })
    ).toBeInTheDocument()
    expect(searchQueries()).toEqual([])
  })

  it("lists a typed job with the company in the properties strip", async () => {
    setMockSearch({
      jobs: [
        {
          id: "job-1",
          title: "Marketing Executive",
          company: "Lumière Cosmetics",
          stage: "interview",
        },
      ],
      documents: [],
      chats: [{ id: "chat-9", title: "A saved chat" }],
    })
    const dialog = await openSearch()
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "Marketing" },
    })

    const job = await within(dialog).findByRole("button", {
      name: /^Marketing Executive/,
    })
    expect(job).toBeInTheDocument()
    await waitFor(() => {
      expect(searchQueries()).toContain("Marketing")
    })

    const strip = dialog.querySelector("[data-slot='palette-properties']")
    const text = strip?.textContent ?? ""
    expect(text.indexOf("Marketing Executive")).toBeGreaterThanOrEqual(0)
    expect(text.indexOf("Marketing Executive")).toBeLessThan(
      text.indexOf("Lumière Cosmetics")
    )
    expect(text).toContain("Interview")
  })

  it("names a paper row with the document name and CV", async () => {
    setMockSearch({
      jobs: [],
      documents: [{ id: "doc-1", name: "Northstar", kind: "cv" }],
      chats: [],
    })
    const dialog = await openSearch()
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "Northstar" },
    })

    expect(
      await within(dialog).findByRole("button", { name: "Northstar CV" })
    ).toBeInTheDocument()
  })

  it("hides chats when the Jobs chip is pressed", async () => {
    setMockChats([
      {
        id: FIXTURE_CHATS[0]!.id,
        title: FIXTURE_CHATS[0]!.title,
        createdAt: FIXTURE_CHATS[0]!.createdAt,
        updatedAt: FIXTURE_CHATS[0]!.updatedAt,
      },
    ])
    const dialog = await openSearch()
    expect(
      await within(dialog).findByRole("button", {
        name: FIXTURE_CHATS[0]!.title,
      })
    ).toBeInTheDocument()

    const chip = within(dialog)
      .getAllByRole("button", { name: "Jobs" })
      .find((button) => button.hasAttribute("aria-pressed"))
    expect(chip).toBeTruthy()
    fireEvent.click(chip!)
    expect(
      within(dialog).queryByRole("button", { name: FIXTURE_CHATS[0]!.title })
    ).not.toBeInTheDocument()
    expect(searchQueries()).toEqual([])
  })

  it("navigates when Enter lands on a page row", async () => {
    const { router } = renderApp("/coach")
    expect(
      await screen.findByRole("button", { name: "Search" })
    ).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const dialog = await screen.findByRole("dialog", { name: "Search" })
    const input = within(dialog).getByRole("textbox", { name: "Search" })
    const apply = within(dialog).getByRole("button", { name: "Apply" })

    for (
      let step = 0;
      step < 8 && apply.getAttribute("aria-current") !== "true";
      step += 1
    ) {
      fireEvent.keyDown(input, { key: "ArrowDown" })
    }
    expect(apply).toHaveAttribute("aria-current", "true")
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/apply")
    })
  })

  it("opens the shell panel when Enter lands on a chat row", async () => {
    const fixture = FIXTURE_CHATS[0]!
    setMockChats([
      {
        id: fixture.id,
        title: fixture.title,
        createdAt: fixture.createdAt,
        updatedAt: fixture.updatedAt,
      },
    ])
    const dialog = await openSearch()
    const input = within(dialog).getByRole("textbox", { name: "Search" })
    const chat = await within(dialog).findByRole("button", {
      name: fixture.title,
    })

    for (
      let step = 0;
      step < 12 && chat.getAttribute("aria-current") !== "true";
      step += 1
    ) {
      fireEvent.keyDown(input, { key: "ArrowDown" })
    }
    expect(chat).toHaveAttribute("aria-current", "true")
    fireEvent.keyDown(input, { key: "Enter" })

    expect(
      await screen.findByRole("region", { name: fixture.title })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: "Search" })
    ).not.toBeInTheDocument()
  })

  it("returns focus to Search on Escape", async () => {
    renderApp("/apply")
    const search = await screen.findByRole("button", { name: "Search" })
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Search" })
      ).not.toBeInTheDocument()
      expect(search).toHaveFocus()
    })
  })
})
