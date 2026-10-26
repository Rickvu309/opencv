import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { HOME_PATH, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { authClient } from "@/lib/auth-client.ts"
import {
  expectApplyLive,
  expectHomeIdle,
  expectPitch,
  expectStub,
  linkNames,
  NAV,
  stubDesktopViewport,
} from "@/routes/app-shell.fixtures.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { failPaperList } from "@/test/paper-api-mock.ts"
import { setMockSession } from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  chatCreateCalls,
  resetShellApiMock,
  setMockChats,
  setMockInbox,
  setMockJobs,
} from "@/test/shell-api-mock.ts"

const shellProfile = vi.hoisted(() => ({
  next: null as null | (() => Promise<unknown>),
}))

vi.mock("@/features/app-shell/shell-api.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/app-shell/shell-api.ts")>()
  return {
    ...actual,
    getShellProfile: () =>
      shellProfile.next ? shellProfile.next() : actual.getShellProfile(),
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
  it("lists the nav in order, with Your work, Favorites, Search and New chat", async () => {
    setMockJobs([
      {
        id: "job-star",
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
    expect(await screen.findByText("Favorites")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument()
    expect(
      within(screen.getByRole("button", { name: "Search" })).getByText(
        /^(⌘K|Ctrl K)$/
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument()
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
      expect(root.router.state.location.pathname).toBe("/app/apply")
    })

    cleanup()
    const app = renderApp("/app")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Apply" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/app/apply")
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
      expect(paper.router.state.location.pathname).toBe("/app/paper")
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
      expect(apply.router.state.location.pathname).toBe("/app/apply")
    })

    cleanup()
    shellProfile.next = async () => ({
      name: SAMPLE_AUTHOR_NAME,
      image: null,
      startPage: "paper",
      timeZone: null,
    })
    const deep = renderApp("/app/paper")
    await expectPaperDrive()
    expect(deep.router.state.location.pathname).toBe("/app/paper")
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
      expect(router.state.location.pathname).toBe("/app/apply")
    })
    expect(screen.getByText(SAMPLE_AUTHOR_NAME)).toBeInTheDocument()
  })

  it("sends /app to Apply when the session read throws", async () => {
    const session = vi
      .spyOn(authClient, "getSession")
      .mockRejectedValue(new TypeError("Failed to fetch"))
    try {
      const { router } = renderApp("/app")
      expect(
        await screen.findByRole("heading", { level: 1, name: "Apply" })
      ).toBeInTheDocument()
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/app/apply")
      })
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument()
      expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument()
    } finally {
      session.mockRestore()
    }
  })

  it("sends a signed-out visitor from /app to sign-in", async () => {
    setMockSession(null)
    const { router } = renderApp("/app")
    expect(
      await screen.findByRole("heading", { name: "Log in to opencv" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in")
    })
    expect(
      screen.queryByRole("heading", { level: 1, name: "Apply" })
    ).toBeNull()
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
    renderApp("/app/jobs")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Jobs" })
    ).toBeInTheDocument()

    cleanup()
    renderApp("/app/inbox")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Inbox" })
    ).toBeInTheDocument()

    cleanup()
    renderApp("/app/coach")
    expect(await screen.findByRole("textbox")).toBeInTheDocument()

    cleanup()
    renderApp(SURFACE_PATHS.settings)
    await expectStub("settings")
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull()
    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument()
    expect(
      screen.getByRole("tab", { name: "Connected apps" })
    ).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Account" })).toBeInTheDocument()
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
    const { router } = renderApp(HOME_PATH)
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(HOME_PATH)
  })

  it("renders a favorite as title then company, and omits the section when empty", async () => {
    setMockJobs([
      {
        id: "job-star",
        title: "Associate PM",
        company: "Northwind",
        starred: true,
      },
      {
        id: "job-plain",
        title: "Hidden role",
        company: "Elsewhere",
        starred: false,
      },
    ])
    renderApp(SURFACE_PATHS.pitch)
    const favorite = await screen.findByRole("link", {
      name: "Associate PM Northwind",
    })
    const text = favorite.textContent ?? ""
    expect(text.indexOf("Associate PM")).toBeGreaterThanOrEqual(0)
    expect(text.indexOf("Associate PM")).toBeLessThan(text.indexOf("Northwind"))
    expect(screen.queryByRole("link", { name: /Hidden role/ })).toBeNull()

    cleanup()
    resetShellApiMock()
    failPaperList()
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    expect(screen.queryByText("Favorites")).not.toBeInTheDocument()
  })

  it("shows an Inbox count only when the payload lists unread items", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveTextContent(
      /^Inbox$/
    )

    cleanup()
    setMockInbox([{ id: "a" }, { id: "b", unread: true }])
    renderApp(SURFACE_PATHS.pitch)
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Inbox" })).toHaveTextContent("1")
    })
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAccessibleName(
      "Inbox"
    )
  })

  it("posts chat.create from New chat and closes the panel with Escape", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()

    const opener = screen.getByRole("button", { name: "New chat" })
    opener.focus()
    fireEvent.click(opener)

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
    expect(opener).toHaveFocus()
  })

  it("opens a dock chip without creating a chat", async () => {
    setMockChats([
      {
        id: "chat-1",
        title: "Checkout notes",
        focusKind: null,
        focusId: null,
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
        focusKind: null,
        focusId: null,
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
    expect(screen.queryByRole("link", { name: "Inbox" })).toBeNull()
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    const dialog = await screen.findByRole("dialog")
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
