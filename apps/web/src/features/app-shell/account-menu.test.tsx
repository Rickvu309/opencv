import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderApp } from "@/test/render-app.tsx"
import {
  accountTrigger,
  openAccountMenu,
  stubDesktopViewport,
} from "@/test/app-shell-fixtures.ts"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  setMockSession,
} from "@/test/auth-client-mock.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { resetShellApiMock } from "@/test/shell-api-mock.ts"

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal("scrollTo", vi.fn())
  setMockSession({
    user: { ...TEST_SESSION_USER, name: "Minh Le", email: "minh@example.com" },
    session: TEST_SESSION,
  })
})

afterEach(() => {
  cleanup()
  resetShellApiMock()
  localStorage.clear()
  vi.unstubAllGlobals()
})

async function renderShell(route: string = SURFACE_PATHS.apply) {
  stubDesktopViewport(true)
  const view = renderApp(route)
  await screen.findByRole("complementary", { name: "Sidebar" })
  return view
}

describe("account row", () => {
  it("is one button with the name, the email and a chevron", async () => {
    await renderShell()
    const trigger = accountTrigger()
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger).toHaveAttribute("aria-haspopup", "menu")
    expect(
      within(trigger).getByText("Minh Le", { selector: "[data-slot]" })
    ).toBeInTheDocument()
    expect(
      within(trigger).getByText("minh@example.com", { selector: "[data-slot]" })
    ).toBeInTheDocument()
    expect(trigger.querySelector("[data-slot='avatar']")).toHaveTextContent(
      "ML"
    )
    expect(trigger.querySelector("svg.lucide-chevrons-up-down")).not.toBeNull()
    expect(
      screen.queryByRole("link", { name: "Settings" })
    ).not.toBeInTheDocument()
  })

  it("opens upward with the header, Settings and Sign out, and nothing invented", async () => {
    await renderShell()
    const menu = await openAccountMenu()
    expect(menu.closest("[data-side]")).toHaveAttribute("data-side", "top")
    expect(within(menu).queryByText("Minh Le")).not.toBeInTheDocument()
    expect(within(menu).getByText("minh@example.com")).toBeInTheDocument()
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual(["Settings", "Sign out"])
    expect(within(menu).getAllByRole("separator")).toHaveLength(1)
    expect(within(menu).queryByText(/theme/i)).not.toBeInTheDocument()
    expect(within(menu).queryByText(/shortcuts/i)).not.toBeInTheDocument()
  })

  it("styles both items alike, with muted icons and a neutral Sign out", async () => {
    await renderShell()
    const menu = await openAccountMenu()
    const settings = within(menu).getByRole("menuitem", { name: "Settings" })
    const signOut = within(menu).getByRole("menuitem", { name: "Sign out" })
    expect(signOut).not.toHaveAttribute("data-variant", "destructive")
    expect(settings.className).toBe(signOut.className)
    expect(settings.querySelector("svg")).toHaveClass("text-muted-foreground")
    expect(signOut.querySelector("svg")).toHaveClass("text-muted-foreground")
    expect(within(menu).getByText("minh@example.com")).toHaveClass(
      "text-muted-foreground",
      "text-xs"
    )
  })

  it("opens Settings from the menu", async () => {
    const { router } = await renderShell()
    await openAccountMenu()
    await userEvent.click(screen.getByRole("menuitem", { name: "Settings" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(SURFACE_PATHS.settings)
    })
  })

  it("signs out to the sign-in page", async () => {
    const { router } = await renderShell()
    await openAccountMenu()
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in")
    })
  })

  it("closes on Escape and returns focus to the row", async () => {
    await renderShell()
    await openAccountMenu()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    })
    expect(accountTrigger()).toHaveFocus()
  })
})
