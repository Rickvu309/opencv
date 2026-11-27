import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { mockJob } from "@/test/apply-job-fixtures.ts"
import { setMockJobs as setApplyJobs } from "@/test/apply-jobs-mock.ts"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { authClient } from "@/lib/auth-client.ts"
import {
  expectApplyLive,
  expectPitch,
  linkNames,
  NAV,
  stubDesktopViewport,
} from "@/test/app-shell-fixtures.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import {
  failPaperList,
  getMockPaperDocs,
  setMockPaperFavorite,
} from "@/test/paper-api-mock.ts"
import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"
import "@/test/warm-routes.ts"
import {
  chatCreateCalls,
  resetShellApiMock,
  setMockChats,
  setMockInbox,
  setMockJobs,
} from "@/test/shell-api-mock.ts"

const OLDER_FORMAT = "This document cannot be opened in Paper."

const shellProfile = vi.hoisted(() => ({
  next: null as null | (() => Promise<unknown>),
}))

vi.mock("@/lib/account-api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/account-api.ts")>()
  return {
    ...actual,
    fetchProfile: () =>
      shellProfile.next ? shellProfile.next() : actual.fetchProfile(),
  }
})

beforeEach(() => {
  sessionStorage.clear()
  shellProfile.next = null
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe("app shell layout", () => {
  const favoritePath = "/paper/11111111-1111-7111-8111-111111111111"

  it("restores a favorite on a fresh app mount", async () => {
    setMockPaperFavorite("11111111-1111-7111-8111-111111111111", true)
    renderApp(favoritePath)
    expect(
      await screen.findByRole("link", { name: "PM track CV" })
    ).toBeInTheDocument()
  })

  it("filters paper favorites before showing recent CVs", async () => {
    const docs = getMockPaperDocs()
    const cv = docs.find((doc) => doc.kind === "cv")!
    docs.push({
      ...cv,
      id: "33333333-3333-7333-8333-333333333333",
      name: "Newer unselected CV",
      updatedAt: "2099-01-01T00:00:00.000Z",
    })
    setMockPaperFavorite("11111111-1111-7111-8111-111111111111", true)
    renderApp(SURFACE_PATHS.pitch)
    expect(
      await screen.findByRole("link", { name: "PM track CV" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Newer unselected CV" })
    ).toBeNull()
    expect(
      screen.queryByRole("link", { name: /Cover: Associate PM intern/ })
    ).toBeNull()
  })

  it("lists the nav in order, with Your work, Favorites, Search and New chat", async () => {
    setMockJobs([
      {
        id: "01900000-0000-7000-8000-0000000000b1",
        title: "Associate PM",
        company: "Northwind",
        starred: true,
      },
    ])
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()

    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(linkNames(nav)).toEqual(NAV)
    for (const name of NAV) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument()
    }
    expect(screen.getByText("Your work")).toBeInTheDocument()
    expect(
      within(nav).getByRole("link", { name: "Paper" }).querySelector("span")
    ).toHaveTextContent("Paper")
    expect(await screen.findByText("Favorites")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument()
    expect(
      within(screen.getByRole("button", { name: "Search" })).getByText(
        /^(⌘K|Ctrl K)$/
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Settings" })
    ).not.toBeInTheDocument()
    expect(screen.getByText(SAMPLE_AUTHOR_NAME)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: SAMPLE_AUTHOR_NAME })
    ).not.toBeInTheDocument()
  })

  it("sends / and /app to Apply when the profile has no start page", async () => {
    const root = renderApp("/")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(root.router.state.location.pathname).toBe("/apply")
    })

    cleanup()
    const app = renderApp("/app")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/apply")
    })
  })

  it("honors startPage paper and apply, and leaves a deep link alone", async () => {
    shellProfile.next = async () => ({
      name: SAMPLE_AUTHOR_NAME,
      image: null,
      startPage: "paper",
      timeZone: null,
    })
    const paper = renderApp("/app")
    await expectPaperDrive()
    await waitFor(() => {
      expect(paper.router.state.location.pathname).toBe("/paper")
    })

    cleanup()
    shellProfile.next = async () => ({
      name: SAMPLE_AUTHOR_NAME,
      image: null,
      startPage: "apply",
      timeZone: null,
    })
    const apply = renderApp("/app")
    await expectApplyLive()
    await waitFor(() => {
      expect(apply.router.state.location.pathname).toBe("/apply")
    })

    cleanup()
    shellProfile.next = async () => ({
      name: SAMPLE_AUTHOR_NAME,
      image: null,
      startPage: "paper",
      timeZone: null,
    })
    const deep = renderApp("/paper")
    await expectPaperDrive()
    expect(deep.router.state.location.pathname).toBe("/paper")
  })

  it("falls back to Apply when the profile call fails", async () => {
    shellProfile.next = async () => {
      throw new Error("profile down")
    }
    const { router } = renderApp("/app")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/apply")
    })
    expect(screen.getByText(SAMPLE_AUTHOR_NAME)).toBeInTheDocument()
  })

  it("leaves / on the landing when the session read throws", async () => {
    const session = vi
      .spyOn(authClient, "getSession")
      .mockRejectedValue(new TypeError("Failed to fetch"))
    try {
      const { router } = renderApp("/")
      await waitFor(() => {
        expect(router.state.isLoading).toBe(false)
        expect(router.state.location.pathname).toBe("/")
      })
      expect(
        screen.queryByRole("heading", { level: 1, name: "Apply" })
      ).not.toBeInTheDocument()
    } finally {
      session.mockRestore()
    }
  })

  it("keeps a signed-out visitor on the landing from /app", async () => {
    setMockSession(null)
    const { router } = renderApp("/app")
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Get your butt in your dream seat.",
      })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/")
    })
  })

  it("sends a signed-out visitor from Coach to sign-in", async () => {
    setMockSession(null)
    const { router } = renderApp("/coach?x=1#h")
    expect(
      await screen.findByRole("heading", { name: "Log in to OpenCV" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in")
    })
    expect(router.state.location.search).toEqual({
      redirect: "/coach?x=1#h",
    })
  })

  it("opens each surface at a stable URL", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()

    cleanup()
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()

    cleanup()
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()

    cleanup()
    renderApp("/jobs")
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Jobs, matched to you",
      })
    ).toBeInTheDocument()

    cleanup()
    renderApp("/inbox")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Inbox" })
    ).toBeInTheDocument()

    cleanup()
    renderApp("/coach")
    expect(await screen.findByRole("textbox")).toBeInTheDocument()

    cleanup()
    renderApp(SURFACE_PATHS.settings)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Preferences" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Back to app" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull()
    expect(
      screen.queryByRole("tab", { name: "General" })
    ).not.toBeInTheDocument()
  }, 20_000)

  it("highlights the active surface and keeps Search a command", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()

    expect(screen.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Apply" })).not.toHaveAttribute(
      "aria-current"
    )
    expect(screen.getByRole("link", { name: "Apply" })).toHaveTextContent(
      /^Apply$/
    )
    expect(
      screen.queryByRole("link", { name: "Search" })
    ).not.toBeInTheDocument()
  })

  it("opens the Search dialog from the sidebar and stays on the same page", async () => {
    const { router } = renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(SURFACE_PATHS.coach)
  })

  it("renders a favorite as its title with the company in its name, and omits the section when empty", async () => {
    setMockJobs([
      {
        id: "01900000-0000-7000-8000-0000000000b1",
        title: "Associate PM",
        company: "Northwind",
        starred: true,
      },
      {
        id: "01900000-0000-7000-8000-0000000000b4",
        title: "Hidden role",
        company: "Elsewhere",
        starred: false,
      },
    ])
    renderApp(SURFACE_PATHS.pitch)
    const favorite = await screen.findByRole("link", {
      name: "Associate PM Northwind",
    })
    expect(favorite.textContent).toBe("Associate PM")
    expect(favorite).toHaveAttribute("title", "Associate PM, Northwind")
    expect(screen.queryByRole("link", { name: /Hidden role/ })).toBeNull()

    cleanup()
    resetShellApiMock()
    failPaperList()
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    expect(screen.queryByText("Favorites")).not.toBeInTheDocument()
  })

  it.each([true, false])(
    "opens the chosen favorite CV with desktop=%s",
    async (desktop) => {
      stubDesktopViewport(desktop)
      setMockPaperFavorite("11111111-1111-7111-8111-111111111111", true)
      const { router } = renderApp(SURFACE_PATHS.pitch)
      await expectPitch()
      if (!desktop) {
        fireEvent.click(await screen.findByRole("button", { name: "Menu" }))
      }
      const favorite = await screen.findByRole("link", { name: "PM track CV" })
      const path = "/paper/11111111-1111-7111-8111-111111111111"
      expect(favorite).toHaveAttribute("href", path)
      fireEvent.click(favorite)
      expect(await screen.findByText(OLDER_FORMAT)).toBeInTheDocument()
      expect(router.state.location.pathname).toBe(path)
      if (!desktop) expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    }
  )

  it.each([true, false])(
    "opens the chosen favorite job with desktop=%s",
    async (desktop) => {
      stubDesktopViewport(desktop)
      const job = mockJob({ starred: true })
      setApplyJobs([job])
      const { router } = renderApp(SURFACE_PATHS.pitch)
      await expectPitch()
      if (!desktop) {
        fireEvent.click(await screen.findByRole("button", { name: "Menu" }))
      }
      const favorite = await screen.findByRole("link", {
        name: `${job.title} ${job.company}`,
      })
      const path = `/apply/${job.id}`
      expect(favorite).toHaveAttribute("href", path)
      fireEvent.click(favorite)
      expect(
        await screen.findByRole("navigation", { name: "Breadcrumb" })
      ).toBeInTheDocument()
      expect(router.state.location.pathname).toBe(path)
      if (!desktop) expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    }
  )

  it("shows an Inbox count for unread threads on the inbox object", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveTextContent(
      /^Inbox$/
    )

    cleanup()
    setMockInbox({
      connected: false,
      skipped: true,
      threads: [
        { id: "a", unread: true },
        { id: "b", unread: true },
        { id: "c", unread: false },
      ],
    })
    renderApp(SURFACE_PATHS.pitch)
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Inbox, 2 unread" })
      ).toHaveTextContent("2")
    })
  })

  it("posts chat.create from New chat and closes the panel with Escape", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()

    fireEvent.click(screen.getByRole("button", { name: "New chat" }))

    expect(
      await screen.findByRole("button", { name: "Close" })
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "New chat" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Minimize" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument()
    expect(chatCreateCalls()).toEqual([
      { input: {}, idempotencyKey: expect.any(String) },
    ])

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Close" })).toBeNull()
    })
    expect(document.activeElement).toHaveAccessibleName("New chat")
    expect(document.activeElement).not.toHaveAttribute("data-chat-id")
  })

  it("opens a dock chip without creating a chat", async () => {
    setMockChats([
      {
        id: "chat-1",
        title: "Checkout notes",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ])
    renderApp(SURFACE_PATHS.pitch)
    fireEvent.click(
      await screen.findByRole("button", { name: "Checkout notes" })
    )
    expect(
      await screen.findByRole("button", { name: "Close" })
    ).toBeInTheDocument()
    expect(chatCreateCalls()).toEqual([])
  })

  it("keeps a typed draft across Expand and Minimize", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    fireEvent.click(screen.getByRole("button", { name: "Coach" }))
    const draft = await screen.findByRole("textbox", { name: "Message Coach" })
    fireEvent.change(draft, { target: { value: "Keep this draft" } })

    fireEvent.click(screen.getByRole("button", { name: "Expand" }))
    expect(screen.getByRole("button", { name: "Expand" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      "Keep this draft"
    )

    fireEvent.click(screen.getByRole("button", { name: "Minimize" }))
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Close" })).toBeNull()
    })
    expect(screen.getByRole("button", { name: "Coach" })).toHaveFocus()

    fireEvent.click(screen.getByRole("button", { name: "Coach" }))
    expect(
      await screen.findByRole("textbox", { name: "Message Coach" })
    ).toHaveValue("Keep this draft")
    fireEvent.click(screen.getByRole("button", { name: "Expand" }))
    expect(screen.getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      "Keep this draft"
    )
  })

  it("opens a dock chip on that chat's messages", async () => {
    setMockChats([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "CV vs internship first",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ])
    renderApp(SURFACE_PATHS.pitch)
    fireEvent.click(
      await screen.findByRole("button", { name: "CV vs internship first" })
    )
    const panel = await screen.findByRole("region", {
      name: "CV vs internship first",
    })
    expect(
      await within(panel).findByText(
        "I don't know if I should chase internships or finish my CV first."
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }))
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "CV vs internship first" })
      ).toHaveFocus()
    })
  })

  it("hides the sidebar at 390 until Menu, and a link closes the drawer", async () => {
    stubDesktopViewport(false)
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()

    expect(
      await screen.findByRole("button", { name: "Menu" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Menu" }).querySelector("svg")
    ).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByRole("link", { name: "Inbox" })).toBeNull()
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog)
        .getByRole("button", { name: "Close menu" })
        .querySelector("svg")
    ).toHaveClass("lucide-x")
    expect(
      within(dialog)
        .getByRole("button", { name: "Close menu" })
        .querySelector("svg")
    ).toHaveAttribute("aria-hidden", "true")
    expect(
      within(dialog).getByRole("link", { name: "Apply" })
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("link", { name: "Apply" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    await expectApplyLive()
  })

  it("returns focus to Menu when Escape closes the drawer", async () => {
    stubDesktopViewport(false)
    renderApp(SURFACE_PATHS.pitch)
    const menu = await screen.findByRole("button", { name: "Menu" })
    fireEvent.click(menu)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(menu).toHaveFocus()
  })
})
