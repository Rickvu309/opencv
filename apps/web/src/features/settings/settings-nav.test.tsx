import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"

import { SettingsNav } from "@/features/settings/settings-nav.tsx"
import { renderPage } from "@/test/render-app.tsx"
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
      user: { ...TEST_SESSION_USER, name: "", email: "" },
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
      "Account"
    )
  })
})
