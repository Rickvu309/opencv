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
import { openAccountMenu } from "@/test/app-shell-fixtures.ts"
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
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "One link that sells you",
      })
    ).toBeInTheDocument()

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
})
