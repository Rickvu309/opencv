import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs } from "@/test/apply-jobs-mock.ts"
import { FIXTURE_CHATS } from "@/test/chat-fixtures.ts"
import { jsonOk, pathOf } from "@/test/mock-http.ts"
import { samplePaperDocs } from "@/test/paper-fixtures.ts"
import { renderApp } from "@/test/render-app.tsx"
import { setMockChats, setMockSearch } from "@/test/shell-api-mock.ts"

const OLDER_FORMAT = "This document cannot be opened in Paper."

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function openSearch(path = "/jobs") {
  renderApp(path)
  expect(
    await screen.findByRole("heading", {
      level: 2,
      name: "Jobs, matched to you",
    })
  ).toBeInTheDocument()
  fireEvent.keyDown(window, { key: "k", ctrlKey: true })
  return screen.findByRole("dialog", { name: "Search" })
}

describe("search results integration", () => {
  it.each(["click", "keyboard"] as const)(
    "opens the chosen job detail with %s activation",
    async (activation) => {
      const first = mockJob({
        id: "01900000-0000-7000-8000-000000000041",
        title: "Junior Designer",
        company: "Northstar",
      })
      const selected = mockJob({
        id: "01900000-0000-7000-8000-000000000042",
        title: "Senior Designer",
        company: "Northstar",
        stage: "interview",
      })
      setMockJobs([first, selected])
      setMockSearch({ jobs: [first, selected], documents: [], chats: [] })
      const { router } = renderApp("/jobs")
      await screen.findByRole("heading", {
        level: 2,
        name: "Jobs, matched to you",
      })
      fireEvent.keyDown(window, { key: "k", ctrlKey: true })
      const dialog = await screen.findByRole("dialog", { name: "Search" })
      const input = within(dialog).getByRole("textbox", { name: "Search" })
      fireEvent.change(input, { target: { value: "Designer" } })
      const result = await within(dialog).findByRole("button", {
        name: /^Senior Designer/,
      })
      expect(router.state.location.pathname).toBe("/jobs")
      if (activation === "click") {
        fireEvent.click(result)
      } else {
        fireEvent.keyDown(input, { key: "ArrowDown" })
        expect(result).toHaveAttribute("aria-current", "true")
        fireEvent.keyDown(input, { key: "Enter" })
      }
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/apply/${selected.id}`)
        expect(
          screen.queryByRole("dialog", { name: "Search" })
        ).not.toBeInTheDocument()
      })
      expect(
        await screen.findByRole("navigation", { name: "Breadcrumb" })
      ).toHaveTextContent(selected.title)
      expect(
        screen.getByRole("textbox", { name: "Leave a note" })
      ).toBeInTheDocument()
    }
  )

  it.each(["click", "keyboard"] as const)(
    "opens the chosen Paper editor with %s activation",
    async (activation) => {
      const selected = samplePaperDocs()[0]!
      const first = samplePaperDocs()[1]!
      setMockSearch({ jobs: [], documents: [first, selected], chats: [] })
      const { router } = renderApp("/jobs")
      await screen.findByRole("heading", {
        level: 2,
        name: "Jobs, matched to you",
      })
      fireEvent.keyDown(window, { key: "k", ctrlKey: true })
      const dialog = await screen.findByRole("dialog", { name: "Search" })
      const input = within(dialog).getByRole("textbox", { name: "Search" })
      fireEvent.change(input, { target: { value: "PM" } })
      const result = await within(dialog).findByRole("button", {
        name: `${selected.name} CV`,
      })
      expect(router.state.location.pathname).toBe("/jobs")
      if (activation === "click") {
        fireEvent.click(result)
      } else {
        fireEvent.keyDown(input, { key: "ArrowDown" })
        expect(result).toHaveAttribute("aria-current", "true")
        fireEvent.keyDown(input, { key: "Enter" })
      }
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/paper/${selected.id}`)
        expect(
          screen.queryByRole("dialog", { name: "Search" })
        ).not.toBeInTheDocument()
      })
      expect(await screen.findByText(OLDER_FORMAT)).toBeVisible()
    }
  )

  it("scrolls arrow-key selection into view, including when selection wraps", async () => {
    const chats = Array.from({ length: 8 }, (_, index) => ({
      id: `scroll-chat-${index}`,
      title: `Scroll result ${index}`,
    }))
    setMockSearch({ jobs: [], documents: [], chats })
    const dialog = await openSearch()
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search" }), {
      target: { value: "Scroll" },
    })
    const first = await within(dialog).findByRole("button", {
      name: "Scroll result 0",
    })
    const second = within(dialog).getByRole("button", {
      name: "Scroll result 1",
    })
    const last = within(dialog).getByRole("button", { name: "Scroll result 7" })
    const secondScroll = vi.fn()
    const lastScroll = vi.fn()
    Object.defineProperty(second, "scrollIntoView", {
      configurable: true,
      value: secondScroll,
    })
    Object.defineProperty(last, "scrollIntoView", {
      configurable: true,
      value: lastScroll,
    })
    const input = within(dialog).getByRole("textbox", { name: "Search" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(second).toHaveAttribute("aria-current", "true")
    expect(secondScroll).toHaveBeenCalledWith({ block: "nearest" })
    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(first).toHaveAttribute("aria-current", "true")
    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(last).toHaveAttribute("aria-current", "true")
    expect(lastScroll).toHaveBeenCalledWith({ block: "nearest" })
  })

  it.each(["retained", "removed"] as const)(
    "scrolls the resolved active row after async results replace a %s selection",
    async (selection) => {
      const first = { id: "refresh-first", title: "Refresh first" }
      const selected = { id: "refresh-selected", title: "Refresh selected" }
      setMockSearch({ jobs: [], documents: [], chats: [first, selected] })
      const dialog = await openSearch()
      const input = within(dialog).getByRole("textbox", { name: "Search" })
      fireEvent.change(input, { target: { value: "Refresh" } })
      const selectedRow = await within(dialog).findByRole("button", {
        name: selected.title,
      })
      fireEvent.keyDown(input, { key: "ArrowDown" })
      expect(selectedRow).toHaveAttribute("aria-current", "true")

      let resolveSearch!: (response: Response) => void
      const response = new Promise<Response>((resolve) => {
        resolveSearch = resolve
      })
      const originalFetch = globalThis.fetch
      vi.stubGlobal(
        "fetch",
        (request: RequestInfo | URL, init?: RequestInit) =>
          pathOf(request) === "/api/reads/workspace.search"
            ? response
            : originalFetch(request, init)
      )
      const scroll = vi.spyOn(Element.prototype, "scrollIntoView")
      fireEvent.change(input, { target: { value: "Refresh again" } })
      expect(selectedRow).toHaveAttribute("aria-current", "true")
      scroll.mockClear()
      const replacement = Array.from({ length: 8 }, (_, index) => ({
        id: `refresh-new-${index}`,
        title: `Refresh replacement ${index}`,
      }))
      const next = selection === "retained" ? selected : replacement[0]!
      await act(async () => {
        resolveSearch(
          jsonOk({
            jobs: [],
            documents: [],
            chats:
              selection === "retained"
                ? [...replacement, selected]
                : replacement,
          })
        )
      })
      await within(dialog).findByRole("button", {
        name: replacement[7]!.title,
      })
      const nextRow = within(dialog).getByRole("button", {
        name: next.title,
      })
      expect(nextRow).toHaveAttribute("aria-current", "true")
      expect(scroll).toHaveBeenCalledWith({ block: "nearest" })
      expect(scroll.mock.contexts.at(-1)).toBe(nextRow)
    }
  )

  it("scrolls the fallback row when a scope removes the selected row", async () => {
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
    const chat = await within(dialog).findByRole("button", {
      name: fixture.title,
    })
    fireEvent.mouseEnter(chat)
    expect(chat).toHaveAttribute("aria-current", "true")
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView")
    fireEvent.click(within(dialog).getByRole("button", { name: "Pages" }))
    const first = within(dialog).getByRole("button", { name: "Inbox" })
    expect(first).toHaveAttribute("aria-current", "true")
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" })
    expect(scroll.mock.contexts.at(-1)).toBe(first)
  })

  it.each(["empty", "matching", "no-match"] as const)(
    "closes search from the touch control for a %s query without navigating",
    async (queryKind) => {
      if (queryKind === "matching") {
        setMockSearch({
          jobs: [
            {
              id: "00000000-0000-4000-8000-000000000003",
              title: "Target job",
              company: "Northstar",
              stage: null,
            },
          ],
          documents: [],
          chats: [],
        })
      }
      const { router } = renderApp("/jobs")
      await screen.findByRole("heading", {
        level: 2,
        name: "Jobs, matched to you",
      })
      fireEvent.keyDown(window, { key: "k", ctrlKey: true })
      const dialog = await screen.findByRole("dialog", { name: "Search" })
      if (queryKind !== "empty") {
        fireEvent.change(
          within(dialog).getByRole("textbox", { name: "Search" }),
          {
            target: {
              value: queryKind === "matching" ? "Target" : "no-match-653-xyz",
            },
          }
        )
        if (queryKind === "matching") {
          await within(dialog).findByRole("button", { name: /^Target job/ })
        } else {
          await within(dialog).findByText('No results for "no-match-653-xyz"')
        }
      }
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Close search" })
      )
      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "Search" })
        ).not.toBeInTheDocument()
      })
      expect(router.state.location.pathname).toBe("/jobs")
    }
  )
})
