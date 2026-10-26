import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { failPaperList } from "@/test/paper-api-mock.ts"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  setMockSession,
} from "@/test/auth-client-mock.ts"
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

const NAV = ["Inbox", "Coach", "Jobs", "Paper", "Apply", "Pitch"]

function stubDesktopViewport(isDesktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === DESKTOP_MEDIA_QUERY ? isDesktop : true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

function linkNames(root: HTMLElement) {
  return within(root)
    .getAllByRole("link")
    .map((el) => el.getAttribute("aria-label") || el.textContent?.trim())
}

async function expectStub(
  surface: Exclude<
    keyof typeof SURFACE_COPY,
    "home" | "paper" | "apply" | "pitch"
  >
) {
  const copy = SURFACE_COPY[surface]
  expect(
    await screen.findByRole("heading", { level: 1, name: copy.title })
  ).toBeInTheDocument()
  expect(screen.getByText(copy.body)).toBeInTheDocument()
}

async function expectPitch() {
  expect(await screen.findByText("Pitch. Coming soon.")).toBeInTheDocument()
}

async function expectApplyLive() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "Apply" })
  ).toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Calendar" })).toBeInTheDocument()
}

async function expectHomeIdle() {
  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: new RegExp(
        `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
      ),
    })
  ).toBeInTheDocument()
}

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
    const { router } = renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    expect(
      await screen.findByRole("dialog", { name: "Search" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)
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

describe("settings workspace", () => {
  it("opens the Connected apps catalog from Home without OAuth", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Connect apps" }))

    expect(
      await screen.findByRole("heading", { level: 2, name: "Connected apps" })
    ).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Connected apps" })).toHaveAttribute(
      "data-active"
    )
    expect(screen.getByRole("heading", { name: "Gmail" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Outlook" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Google Calendar" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Connect/ })).toHaveLength(3)
    for (const button of screen.getAllByRole("button", { name: /Connect/ })) {
      expect(button).toBeDisabled()
    }
  })

  it("shows the session identity and signs out to sign-in", async () => {
    const { router } = renderApp(`${SURFACE_PATHS.settings}?tab=account`)

    expect(
      await screen.findByRole("heading", { level: 2, name: "Account" })
    ).toBeInTheDocument()
    expect(screen.getAllByText(SAMPLE_AUTHOR_NAME).length).toBeGreaterThan(0)
    expect(screen.getByText("you@opencv.me")).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Aspiring product manager/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Sample Pitch/i)).not.toBeInTheDocument()
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
    expect(
      await screen.findByRole("heading", { name: "Log in to opencv" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in")
    })
  })

  it("shows the signed-in User, not a build-time placeholder", async () => {
    setMockSession({
      user: {
        ...TEST_SESSION_USER,
        name: "Minh Le",
        email: "minh@example.com",
      },
      session: TEST_SESSION,
    })
    renderApp(`${SURFACE_PATHS.settings}?tab=account`)

    expect(
      await screen.findByRole("heading", { level: 2, name: "Account" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Minh Le").length).toBeGreaterThan(0)
    expect(screen.getByText("minh@example.com")).toBeInTheDocument()
  })

  it("keeps Settings Account as the session User after leaving Pitch", async () => {
    setMockSession({
      user: {
        ...TEST_SESSION_USER,
        name: "Minh Le",
        email: "minh@example.com",
      },
      session: TEST_SESSION,
    })
    renderApp(SURFACE_PATHS.pitch)
    expect(await screen.findByText("Pitch. Coming soon.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Settings" }))
    fireEvent.click(await screen.findByRole("tab", { name: "Account" }))
    expect(
      await screen.findByRole("heading", { level: 2, name: "Account" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Minh Le").length).toBeGreaterThan(0)
    expect(screen.getByText("minh@example.com")).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Aspiring product manager/i)
    ).not.toBeInTheDocument()
  })
})

describe("shell polish and a11y", () => {
  it("exposes a skip link, the sidebar, and the dock", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()

    expect(
      screen.getByRole("link", { name: "Skip to main content" })
    ).toHaveAttribute("href", "#app-main")
    expect(document.getElementById("app-main")).not.toBeNull()
    expect(
      screen.getByRole("complementary", { name: "Sidebar" })
    ).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(
      screen.queryByRole("navigation", { name: "History" })
    ).not.toBeInTheDocument()
  })

  it("lets Settings tabs take focus and activate from the keyboard", async () => {
    renderApp(SURFACE_PATHS.settings)
    await expectStub("settings")

    const general = screen.getByRole("tab", { name: "General" })
    const apps = screen.getByRole("tab", { name: "Connected apps" })
    const account = screen.getByRole("tab", { name: "Account" })

    general.focus()
    expect(general).toHaveFocus()
    expect(general).toHaveAttribute("aria-selected", "true")

    apps.focus()
    expect(apps).toHaveFocus()
    fireEvent.click(apps)
    expect(apps).toHaveAttribute("aria-selected", "true")
    expect(
      await screen.findByRole("heading", { level: 2, name: "Connected apps" })
    ).toBeInTheDocument()

    account.focus()
    fireEvent.click(account)
    expect(account).toHaveAttribute("aria-selected", "true")
    expect(
      await screen.findByRole("heading", { level: 2, name: "Account" })
    ).toBeInTheDocument()
  })
})
