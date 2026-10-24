import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_COPY, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  setMockSession,
} from "@/test/auth-client-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

const sidebarOpenOnRender = vi.hoisted(() => ({ values: [] as boolean[] }))

vi.mock("@/features/app-shell/app-sidebar.tsx", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/app-shell/app-sidebar.tsx")
    >()

  return {
    ...actual,
    AppSidebar: (props: Parameters<typeof actual.AppSidebar>[0]) => {
      sidebarOpenOnRender.values.push(props.open)
      return actual.AppSidebar(props)
    },
  }
})

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
  expect(
    await screen.findByRole("heading", {
      level: 2,
      name: SAMPLE_AUTHOR_NAME,
    })
  ).toBeInTheDocument()
  expect(
    screen.getByRole("button", { name: "Edit Pitch" })
  ).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument()
  expect(screen.queryByText(SURFACE_COPY.pitch.body)).not.toBeInTheDocument()
  expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
}

async function expectApplyLive() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "Apply" })
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Board" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument()
  expect(await screen.findByText("Inbox")).toBeInTheDocument()
  expect(screen.queryByText(SURFACE_COPY.apply.body)).not.toBeInTheDocument()
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
  sidebarOpenOnRender.values = []
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe("app shell layout", () => {
  it("defaults the app root to Home", async () => {
    const { router } = renderApp("/")
    await expectHomeIdle()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.home)
    })
  })

  it("opens Home at /app", async () => {
    renderApp("/app")
    await expectHomeIdle()
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
    renderApp(SURFACE_PATHS.settings)
    await expectStub("settings")
    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument()
    expect(
      screen.getByRole("tab", { name: "Connected apps" })
    ).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Account" })).toBeInTheDocument()
  }, 15_000)

  it("navigates Home → Paper → Home and keeps titles in the main pane", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectPaperDrive()
    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: /Good (morning|afternoon|evening)/,
      })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Home" }))
    await expectHomeIdle()
    expect(
      screen.queryByRole("heading", { level: 1, name: "Paper" })
    ).not.toBeInTheDocument()
  })

  it("highlights the active surface and keeps Search a command, not a page", async () => {
    renderApp(SURFACE_PATHS.paper)
    await expectPaperDrive()

    expect(screen.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current"
    )

    expect(screen.getByRole("link", { name: "Apply" })).toHaveTextContent(
      /^Apply$/
    )
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument()
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

  it("left-aligns expanded Search with the other nav rows and centers it when collapsed", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    const sidebar = screen.getByRole("complementary", { name: "App" })
    expect(sidebar).toHaveAttribute("data-expanded", "true")

    const search = within(sidebar).getByRole("button", { name: "Search" })
    const home = within(sidebar).getByRole("link", { name: "Home" })

    expect(search).toHaveClass("justify-start")
    expect(search).not.toHaveClass("justify-center")
    expect(home).toHaveClass("justify-start")

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(sidebar).toHaveAttribute("data-expanded", "false")
    const collapsedSearch = within(sidebar).getByRole("button", {
      name: "Search",
    })
    expect(collapsedSearch).toHaveClass("justify-center")
    expect(collapsedSearch).not.toHaveClass("justify-start")
  })

  it("opens Settings from the profile footer, not a demo persona", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    const profile = screen.getByRole("link", {
      name: /profile and settings/i,
    })
    expect(profile).toHaveTextContent(/Alex Tran/)
    expect(profile).not.toHaveTextContent(/Eric Nguyen/)

    expect(
      screen.queryByRole("link", { name: "Settings" })
    ).not.toBeInTheDocument()

    fireEvent.click(profile)
    await expectStub("settings")
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "data-active"
    )
    expect(
      screen.getByRole("link", { name: /profile and settings/i })
    ).toHaveAttribute("aria-current", "page")
  })

  it("starts collapsed on first paint at a narrow viewport", async () => {
    stubDesktopViewport(false)
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    expect(sidebarOpenOnRender.values[0]).toBe(false)
    expect(screen.getByRole("complementary", { name: "App" })).toHaveAttribute(
      "data-expanded",
      "false"
    )
    expect(
      screen.getByRole("button", { name: "Expand sidebar" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Close sidebar" })
    ).not.toBeInTheDocument()
  })

  it("starts expanded on first paint at a desktop viewport", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    expect(sidebarOpenOnRender.values[0]).toBe(true)
    expect(screen.getByRole("complementary", { name: "App" })).toHaveAttribute(
      "data-expanded",
      "true"
    )
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" })
    ).toBeInTheDocument()
  })

  it("keeps nav usable after the sidebar collapses", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))
    expect(
      screen.getByRole("button", { name: "Expand sidebar" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectPaperDrive()
    expect(screen.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "aria-current",
      "page"
    )

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Paper" })).toHaveTextContent(
      "Paper"
    )
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
      await screen.findByRole("heading", { name: "Welcome back" })
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

  it("keeps Settings Account as the session User after Clear demo", async () => {
    setMockSession({
      user: {
        ...TEST_SESSION_USER,
        name: "Minh Le",
        email: "minh@example.com",
      },
      session: TEST_SESSION,
    })
    renderApp(SURFACE_PATHS.pitch)

    expect(
      await screen.findByRole("heading", { level: 2, name: "Minh Le" })
    ).toBeInTheDocument()
    expect(screen.getByText("Demo content")).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Clear demo" })[0]!)
    expect(await screen.findByText("Your Pitch is empty")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("link", { name: /profile and settings/i }))
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
  it("exposes landmarks, a skip link, and keeps History out of the tab order when collapsed", async () => {
    renderApp(SURFACE_PATHS.home)
    await expectHomeIdle()

    expect(
      screen.getByRole("link", { name: "Skip to main content" })
    ).toHaveAttribute("href", "#app-main")
    expect(document.getElementById("app-main")).not.toBeNull()
    expect(
      screen.getByRole("complementary", { name: "App" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("navigation", { name: "Surfaces" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("navigation", { name: "History" })
    ).toBeInTheDocument()
    expect(screen.getByRole("main")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }))

    expect(
      screen.queryByRole("navigation", { name: "History" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "History" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Paper" })).toBeInTheDocument()
    expect(
      screen
        .getByRole("link", { name: /profile and settings/i })
        .closest(".mt-auto")
    ).not.toBeNull()
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
