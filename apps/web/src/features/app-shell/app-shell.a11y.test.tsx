import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectPitch } from "@/test/app-shell-fixtures.ts"
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

  it("lets Settings sections take focus and activate from the keyboard", async () => {
    renderApp(SURFACE_PATHS.settings)
    const preferences = await screen.findByRole("link", { name: "Preferences" })
    expect(preferences).toHaveAttribute("aria-current", "page")
    preferences.focus()
    expect(preferences).toHaveFocus()

    const account = screen.getByRole("link", { name: "Account" })
    account.focus()
    expect(account).toHaveFocus()
    fireEvent.click(account)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Account" })
    ).toBeInTheDocument()
  })
})
