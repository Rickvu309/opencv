import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import { SURFACE_PATHS } from "@/features/app-shell/surfaces.ts"
import { expectPitch, expectStub } from "@/test/app-shell-fixtures.ts"
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
