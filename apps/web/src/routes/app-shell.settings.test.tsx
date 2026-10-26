import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { HOME_PATH, SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { expectHomeIdle } from "@/test/app-shell-fixtures.ts"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  setMockSession,
} from "@/test/auth-client-mock.ts"
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
  it("opens the Connected apps catalog from Home without OAuth", async () => {
    renderApp(HOME_PATH)
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
