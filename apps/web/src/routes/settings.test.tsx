import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { DESKTOP_MEDIA_QUERY } from "@/features/app-shell/use-media-query.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import { authClient } from "@/lib/auth-client.ts"
import {
  getLastDelete,
  getLastProfileUpdate,
  getMockCoachMode,
  getProfileMockPaths,
  setMockEmailChange,
  setMockPlan,
  setMockWeekUncapped,
} from "@/test/profile-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const SECTIONS = [
  "Preferences",
  "Coach",
  "Integrations",
  "Usage & limits",
  "Billing",
  "Account",
] as const

async function choose(name: string, option: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole("combobox", { name }))
  const list = await screen.findByRole("listbox")
  await user.click(within(list).getByRole("option", { name: option }))
}

async function expectUpgradePlaceholder() {
  await screen.findByText("Billing is not open yet.")
  expect(screen.getByText("Billing is not open yet.")).toBeInTheDocument()
}

describe("settings", () => {
  it("shows Back to app and the six sections, with Preferences current", async () => {
    renderApp("/settings")
    expect(
      await screen.findByRole("link", { name: "Back to app" })
    ).toHaveAttribute("href", "/apply")
    for (const name of SECTIONS) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument()
    }
    expect(screen.getByRole("link", { name: "Preferences" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("stores Tiếng Việt and keeps the page in English", async () => {
    renderApp("/settings")
    expect(
      await screen.findByRole("radio", { name: "English" })
    ).toHaveAttribute("aria-checked", "true")
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }))
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ language: "vi" })
    })
    expect(
      screen.getByRole("heading", { name: "Preferences" })
    ).toBeInTheDocument()
    expect(screen.getByText("Words in menus and buttons")).toBeInTheDocument()
    expect(screen.getByText("Time zone")).toBeInTheDocument()
  })

  it("posts the Singapore time zone", async () => {
    renderApp("/settings")
    await screen.findByRole("heading", { name: "Preferences" })
    await choose("Time zone", "Singapore (UTC+8)")
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ timeZone: "Asia/Singapore" })
    })
  })

  it("posts Inbox as the start page", async () => {
    renderApp("/settings")
    await screen.findByRole("heading", { name: "Preferences" })
    await choose("Start page", "Inbox")
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ startPage: "inbox" })
    })
  })

  it("toggles email notifications from Enabled to Disabled", async () => {
    renderApp("/settings")
    const email = await screen.findByRole("button", { name: /^Email/ })
    expect(email).toHaveTextContent("Enabled")
    fireEvent.click(email)
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ notifyEmail: false })
    })
    expect(screen.getByRole("button", { name: /^Email/ })).toHaveTextContent(
      "Disabled"
    )
  })

  it("turns memory off", async () => {
    renderApp("/settings/coach")
    const memory = await screen.findByRole("switch", { name: /Enable memory/ })
    fireEvent.click(memory)
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ memoryEnabled: false })
    })
  })

  it("turns the weekly plan on from Disabled", async () => {
    renderApp("/settings/coach")
    const row = await screen.findByRole("button", { name: /Weekly plan/ })
    expect(row).toHaveTextContent("Disabled")
    fireEvent.click(row)
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ agentWeekly: true })
    })
  })

  it("turns interview prep off", async () => {
    renderApp("/settings/coach")
    fireEvent.click(
      await screen.findByRole("button", { name: /Interview prep/ })
    )
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ agentInterview: false })
    })
  })

  it("shows the week percent and hides the raw turn count", async () => {
    renderApp("/settings/usage")
    expect(await screen.findByText("52% used")).toBeInTheDocument()
    expect(screen.queryByText("17")).not.toBeInTheDocument()
    expect(screen.queryByText(/turns/i)).not.toBeInTheDocument()
  })

  it("shows the uncapped week sentence", async () => {
    setMockWeekUncapped()
    renderApp("/settings/usage")
    expect(
      await screen.findByText("No weekly cap on this mode.")
    ).toBeInTheDocument()
  })

  it("opens the upgrade placeholder from usage with no card field", async () => {
    renderApp("/settings/usage")
    fireEvent.click(
      await screen.findByRole("button", { name: "Upgrade to Pro" })
    )
    await expectUpgradePlaceholder()
    expect(
      screen.queryByRole("textbox", { name: /card/i })
    ).not.toBeInTheDocument()
  })

  it("shows the free plan and a single Upgrade now glow", async () => {
    renderApp("/settings/billing")
    expect(await screen.findByText("Free plan")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Upgrade now" })
    ).toBeInTheDocument()
    expect(screen.getByText("No card added")).toBeInTheDocument()
    expect(screen.getByText("None yet")).toBeInTheDocument()
    const glows = glowButtons()
    expect(glows).toHaveLength(1)
    expect(glows[0]).toHaveAccessibleName("Upgrade now")
    fireEvent.click(screen.getByRole("button", { name: "Add card" }))
    await expectUpgradePlaceholder()
  })

  it("keeps Upgrade now as the only glow on Pro", async () => {
    setMockPlan("pro")
    renderApp("/settings/billing")
    expect(
      await screen.findByText("You're on the Pro plan.")
    ).toBeInTheDocument()
    const glows = glowButtons()
    expect(glows).toHaveLength(1)
    expect(glows[0]).toHaveAccessibleName("Upgrade now")
    fireEvent.click(glows[0]!)
    await expectUpgradePlaceholder()
  })

  it("downloads the export and does not open a card form", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    renderApp("/settings/account")
    fireEvent.click(await screen.findByRole("button", { name: "Export" }))
    await waitFor(() => {
      expect(getProfileMockPaths()).toContain("/api/account/export")
    })
    expect(
      screen.queryByRole("textbox", { name: /card/i })
    ).not.toBeInTheDocument()
  })

  it("rejects an incomplete email and does not post", async () => {
    renderApp("/settings/account")
    fireEvent.click(await screen.findByRole("button", { name: "Change email" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Email" }), {
      target: { value: "not-an-email" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Change email" })
    )
    expect(
      within(dialog).getByText("Use a full email, like name@example.com.")
    ).toBeInTheDocument()
    expect(
      getProfileMockPaths().some((path) => path.includes("requestEmailChange"))
    ).toBe(false)
  })

  it("deletes the account only after DELETE", async () => {
    renderApp("/settings/account")
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete account" })
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Delete your account?",
    })
    const confirm = within(dialog).getByRole("button", {
      name: "Delete account",
    })
    expect(confirm).toBeDisabled()
    const field = within(dialog).getByRole("textbox", {
      name: "Type DELETE to confirm",
    })
    fireEvent.change(field, { target: { value: "DELE" } })
    expect(confirm).toBeDisabled()
    fireEvent.change(field, { target: { value: "DELETE" } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => {
      expect(getLastDelete()).toEqual({ confirm: "DELETE" })
    })
    expect(
      await screen.findByRole("heading", { name: "Log in to opencv" })
    ).toBeInTheDocument()
  })

  it("signs out through the auth client", async () => {
    renderApp("/settings/account")
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }))
    expect(
      await screen.findByRole("heading", { name: "Log in to opencv" })
    ).toBeInTheDocument()
    expect(authClient.signOut).toHaveBeenCalled()
  })

  it("keeps Free when profile.update asks for a Pro mode", async () => {
    renderApp("/settings/coach")
    expect(
      await screen.findByRole("heading", { name: "Coach" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("radiogroup", { name: "Coach mode" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Free is included. Light and Max need Pro.")
    ).not.toBeInTheDocument()
    await expect(
      runContractCommand(new QueryClient(), "profile.update", {
        coachMode: "light",
      })
    ).rejects.toMatchObject({
      code: "PLAN_REQUIRED",
    })
    expect(getMockCoachMode()).toBe("free")
  })

  it("keeps the email dialog open and shows the server message", async () => {
    setMockEmailChange({
      sent: false,
      message: "Mailbox refused the code. Try again.",
    })
    renderApp("/settings/account")
    fireEvent.click(await screen.findByRole("button", { name: "Change email" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Email" }), {
      target: { value: "ada-next@example.com" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Change email" })
    )
    expect(
      await within(dialog).findByText("Mailbox refused the code. Try again.")
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.queryByLabelText("Digit 1")).not.toBeInTheDocument()
  })

  it("shows a failed send from the command error and keeps the dialog open", async () => {
    setMockEmailChange({ error: "We could not send the code. Try again." })
    renderApp("/settings/account")
    fireEvent.click(await screen.findByRole("button", { name: "Change email" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Email" }), {
      target: { value: "ada-next@example.com" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Change email" })
    )
    expect(
      await within(dialog).findByText("We could not send the code. Try again.")
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("uses a Section select at 390", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === DESKTOP_MEDIA_QUERY ? false : true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }))
    renderApp("/settings")
    expect(
      await screen.findByRole("combobox", { name: /Section/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Preferences" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Back to app" })
    ).toBeInTheDocument()
  })
})

function glowButtons() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.classList.contains("glow"))
}
