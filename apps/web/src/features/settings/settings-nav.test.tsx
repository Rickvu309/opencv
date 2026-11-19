import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SettingsNav } from "@/features/settings/settings-nav.tsx"
import { renderApp, renderPage } from "@/test/render-app.tsx"
import {
  holdProfileFetch,
  releaseProfileFetch,
} from "@/test/profile-api-mock.ts"
import {
  TEST_SESSION,
  TEST_SESSION_USER,
  resetMockSession,
  setMockSession,
} from "@/test/auth-client-mock.ts"

afterEach(() => {
  releaseProfileFetch()
  cleanup()
  resetMockSession()
  vi.unstubAllGlobals()
})

describe("settings nav footer", () => {
  it("hides the settings footer until the profile resolves", async () => {
    vi.stubGlobal("scrollTo", vi.fn())
    setMockSession({
      user: { ...TEST_SESSION_USER, name: "", email: "ada@example.com" },
      session: TEST_SESSION,
    })
    holdProfileFetch()
    renderPage(() => <SettingsNav />)
    const nav = await screen.findByRole("complementary", { name: "Settings" })
    expect(nav.querySelector("[data-slot='settings-nav-footer']")).toBeNull()
    releaseProfileFetch()
    await waitFor(() => {
      expect(
        nav.querySelector("[data-slot='settings-nav-footer']")
      ).not.toBeNull()
    })
    expect(nav.querySelector("[data-slot='account-name']")).toHaveTextContent(
      "ada@example.com"
    )
  })

  it("names the person with the saved Account name and never a name made from the email", async () => {
    vi.stubGlobal("scrollTo", vi.fn())
    setMockSession({
      user: { ...TEST_SESSION_USER, name: "", email: "ada@example.com" },
      session: TEST_SESSION,
    })
    const user = userEvent.setup()
    renderApp("/settings/account")
    const nav = await screen.findByRole("complementary", { name: "Settings" })
    const field = await screen.findByRole("textbox", { name: "Name" })
    expect(field).toHaveValue("")
    await waitFor(() => {
      expect(within(nav).getByText("ada@example.com")).toBeVisible()
    })
    expect(within(nav).queryByText("ada")).toBeNull()
    await user.type(field, "Ada Lovelace")
    await user.tab()
    await waitFor(() => {
      expect(within(nav).getByText("Ada Lovelace")).toBeVisible()
    })
    expect(field).toHaveValue("Ada Lovelace")
  })
})
