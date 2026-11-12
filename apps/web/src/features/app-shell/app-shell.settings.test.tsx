import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  setMockSession,
} from "@/test/auth-client-mock.ts"
import {
  openAccountMenu,
  stubDesktopViewport,
} from "@/test/app-shell-fixtures.ts"
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

describe("settings workspace", () => {
  it("keeps the chat store available while navigating from Coach to Settings", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const { router } = renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    await openAccountMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Preferences" })
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.settings)
    })
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "useChatStore must be used within ChatStoreProvider"
    )
  })

  it("shows the session identity and signs out to sign-in", async () => {
    const { router } = renderApp(`${SURFACE_PATHS.settings}/account`)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Account" })
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
    renderApp(`${SURFACE_PATHS.settings}/account`)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Account" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Minh Le").length).toBeGreaterThan(0)
    expect(screen.getByText("minh@example.com")).toBeInTheDocument()
  })

  it("keeps Settings Account as the session User after leaving Coach", async () => {
    setMockSession({
      user: {
        ...TEST_SESSION_USER,
        name: "Minh Le",
        email: "minh@example.com",
      },
      session: TEST_SESSION,
    })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    await openAccountMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }))
    fireEvent.click(await screen.findByRole("link", { name: "Account" }))
    expect(
      await screen.findByRole("heading", { level: 1, name: "Account" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("Minh Le").length).toBeGreaterThan(0)
    expect(screen.getByText("minh@example.com")).toBeInTheDocument()
    expect(screen.queryByText(/Eric Nguyen/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Aspiring product manager/i)
    ).not.toBeInTheDocument()
  })

  it("sits inside the app frame with the Settings nav in the sidebar slot and the Coach dock", async () => {
    stubDesktopViewport(true)
    renderApp(`${SURFACE_PATHS.settings}/integrations`)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Integrations" })
    ).toBeInTheDocument()

    const shell = document.querySelector('[data-slot="app-shell"]')!
    const nav = screen.getByRole("complementary", { name: "Settings" })
    expect(shell).toContainElement(nav)
    expect(nav).toHaveAttribute("data-slot", "settings-nav")
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull()
    const main = document.getElementById("app-main")!
    expect(main).toContainElement(
      document.querySelector('[data-slot="settings-layout"]') as HTMLElement
    )
    expect(main).not.toContainElement(nav)
    expect(main.querySelectorAll("main")).toHaveLength(0)

    const coach = screen.getByRole("button", { name: "Coach" })
    expect(document.querySelector('[data-slot="app-dock"]')).toContainElement(
      coach
    )
    fireEvent.click(coach)
    expect(
      await screen.findByRole("textbox", { name: "Message Coach" })
    ).toBeInTheDocument()
    expect(coach).toHaveAttribute("aria-expanded", "true")
    fireEvent.keyDown(document.getElementById("coach-panel")!, {
      key: "Escape",
    })
    await waitFor(() => {
      expect(coach).toHaveAttribute("aria-expanded", "false")
    })
    expect(
      screen.getByRole("heading", { level: 1, name: "Integrations" })
    ).toBeInTheDocument()
  })

  it("goes back to the previous section with browser back", async () => {
    stubDesktopViewport(true)
    const { router } = renderApp(SURFACE_PATHS.settings)
    await screen.findByRole("heading", { level: 1, name: "Preferences" })

    fireEvent.click(screen.getByRole("link", { name: "Account" }))
    expect(
      await screen.findByRole("heading", { level: 1, name: "Account" })
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(
      `${SURFACE_PATHS.settings}/account`
    )

    router.history.back()
    expect(
      await screen.findByRole("heading", { level: 1, name: "Preferences" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Preferences" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })
})
