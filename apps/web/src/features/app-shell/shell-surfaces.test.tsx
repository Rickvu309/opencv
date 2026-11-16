import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, within } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  resetMockSession,
  setMockSession,
} from "@/test/auth-client-mock.ts"

afterEach(() => {
  cleanup()
  resetMockSession()
  vi.unstubAllGlobals()
})

describe("shell identity and Proofs", () => {
  it("shows the email local part, not Account, in both footers", async () => {
    vi.stubGlobal("scrollTo", vi.fn())
    setMockSession({
      user: { ...TEST_SESSION_USER, name: "" },
      session: TEST_SESSION,
    })
    const { router } = renderApp(SURFACE_PATHS.apply)
    const account = await screen.findByRole("button", {
      name: /you@opencv\.me/,
    })
    expect(within(account).getByText("you")).toBeInTheDocument()
    expect(within(account).queryByText("Account")).toBeNull()
    expect(account.querySelector("[data-slot='avatar']")).toHaveTextContent("Y")

    await router.navigate({ to: SURFACE_PATHS.settings })
    const footer = await screen.findByRole("complementary", {
      name: "Settings",
    })
    const identity = footer.querySelector("[data-slot='settings-nav-footer']")
    expect(identity).not.toBeNull()
    expect(within(identity as HTMLElement).getByText("you")).toBeInTheDocument()
    expect(within(identity as HTMLElement).queryByText("Account")).toBeNull()
    expect(
      identity?.querySelector("[data-slot='account-name']")
    ).toHaveAttribute("title", "you@opencv.me")
    expect(identity?.querySelector("[data-slot='avatar']")).toHaveTextContent(
      "Y"
    )
  })

  it("highlights Paper on Proofs and offers Proofs in search", async () => {
    vi.stubGlobal("scrollTo", vi.fn())
    renderApp(SURFACE_PATHS.proofs)
    const nav = await screen.findByRole("navigation", { name: "Main" })
    expect(within(nav).getByRole("link", { name: "Paper" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(within(nav).queryByRole("link", { name: "Proofs" })).toBeNull()

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const dialog = await screen.findByRole("dialog", { name: "Search" })
    expect(
      within(dialog).getByRole("button", { name: "Proofs" })
    ).toBeInTheDocument()
  })
})
