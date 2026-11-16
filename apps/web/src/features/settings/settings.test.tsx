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

import { DESKTOP_MEDIA_QUERY } from "@/lib/use-media-query.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import { authClient } from "@/lib/auth-client.ts"
import {
  getLastDelete,
  getLastProfileUpdate,
  getMockCoachMode,
  getProfileMockPaths,
  setMockEmailChange,
  setMockPlan,
  setMockProfile,
  setMockWeekUncapped,
} from "@/test/profile-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

describe("settings", () => {
  it("shows a persisted profile photo after reopening Account", async () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
      true
    )
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
      180
    )
    const fileId = "68800000-0000-4000-8000-000000000001"
    setMockProfile({ image: fileId })
    renderApp("/settings/account")
    const photoPath = `/api/paper/files/${fileId}/bytes`
    await waitFor(() => {
      expect(document.querySelector("img[src]")).toHaveAttribute(
        "src",
        expect.stringContaining(photoPath)
      )
    })
    cleanup()
    renderApp("/settings/account")
    await waitFor(() => {
      expect(document.querySelector("img[src]")).toHaveAttribute(
        "src",
        expect.stringContaining(photoPath)
      )
    })
  })

  it("offers no app connection Integrations cannot make", async () => {
    renderApp("/settings/integrations")
    expect(
      await screen.findByRole("heading", { name: "Your agents" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Connect Gmail/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("searchbox", { name: "Search integrations" })
    ).not.toBeInTheDocument()
    for (const app of ["Gmail", "Google Calendar", "Outlook", "Zoom"]) {
      expect(screen.queryByText(app)).not.toBeInTheDocument()
    }
    expect(document.querySelector('[data-slot="integration-card"]')).toBeNull()
  })

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
    const english = await screen.findByRole("radio", { name: "English" })
    expect(english).toHaveAttribute("aria-checked", "true")
    expect(english.querySelector("svg")).not.toBeNull()
    expect(
      screen.getByRole("radio", { name: "Tiếng Việt" }).querySelector("svg")
    ).toBeNull()
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }))
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ language: "vi" })
    })
    expect(
      screen.getByRole("heading", { name: "Preferences" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Menus and buttons stay in English for now")
    ).toBeInTheDocument()
    expect(screen.queryByText("Words in menus and buttons")).toBeNull()
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

  it("posts Paper as the start page and omits hidden Inbox", async () => {
    renderApp("/settings")
    await screen.findByRole("heading", { name: "Preferences" })
    await choose("Start page", "Paper")
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ startPage: "paper" })
    })
    expect(
      screen.queryByRole("option", { name: "Inbox" })
    ).not.toBeInTheDocument()
  })

  it("offers no notification switch, since nothing sends notifications", async () => {
    renderApp("/settings")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Preferences" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Email/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Browser/ })).toBeNull()
    expect(screen.queryByRole("switch", { name: /Email|Browser/ })).toBeNull()
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull()
  })

  it("lands a link to the removed Notifications section on Preferences", async () => {
    const { router } = renderApp("/settings/notifications")
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings")
    })
    expect(
      await screen.findByRole("heading", { level: 1, name: "Preferences" })
    ).toBeInTheDocument()
  })

  it("turns memory off", async () => {
    renderApp("/settings/coach")
    const memory = await screen.findByRole("switch", { name: /Enable memory/ })
    fireEvent.click(memory)
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ memoryEnabled: false })
    })
  })

  it("turns Coach chat off with a switch that states its state, not a navigation row", async () => {
    renderApp("/settings/coach")
    const chat = await screen.findByRole("switch", {
      name: "Coach chat, Enabled",
    })
    expect(chat).toBeChecked()
    expect(
      screen.getByText("Chat with Coach on its page and in the side panel")
    ).toBeInTheDocument()
    const row = chat.closest("[data-row=agentChat]")
    expect(row?.querySelector("button[data-slot=settings-row-body]")).toBeNull()
    expect(row?.querySelector("svg.lucide-chevron-right")).toBeNull()
    fireEvent.click(chat)
    await waitFor(() => {
      expect(getLastProfileUpdate()).toEqual({ agentChat: false })
    })
  })

  it("offers no Weekly plan, since nothing sends one", async () => {
    renderApp("/settings/coach")
    expect(
      await screen.findByRole("switch", { name: /Interview prep/ })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Weekly plan/ })).toBeNull()
    expect(screen.queryByRole("switch", { name: /Weekly plan/ })).toBeNull()
    expect(screen.queryByText(/Every Monday/)).toBeNull()
  })

  it("turns interview prep off", async () => {
    renderApp("/settings/coach")
    fireEvent.click(
      await screen.findByRole("switch", { name: /Interview prep/ })
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

  it("shows usage without an upgrade upsell", async () => {
    renderApp("/settings/usage")
    expect(
      await screen.findByRole("heading", { level: 1, name: "Usage & limits" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Upgrade to Pro" })
    ).not.toBeInTheDocument()
  })

  it("shows the free plan without purchase controls", async () => {
    renderApp("/settings/billing")
    expect(await screen.findByText("Free plan")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Upgrade now" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add card" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("No card added")).not.toBeInTheDocument()
    expect(screen.queryByText("None yet")).not.toBeInTheDocument()
    expect(glowButtons()).toHaveLength(0)
  })

  it("shows the pro plan without purchase controls", async () => {
    setMockPlan("pro")
    renderApp("/settings/billing")
    expect(
      await screen.findByText("You're on the Pro plan.")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Upgrade now" })
    ).not.toBeInTheDocument()
    expect(glowButtons()).toHaveLength(0)
  })

  it("redirects billing upgrade route to start page", async () => {
    const { router } = renderApp("/settings/billing/upgrade")
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/apply")
    })
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
    const back = screen.getByRole("link", { name: "Back to app" })
    expect(back).toHaveAttribute("data-slot", "page-header-back")
    expect(back).toHaveClass("h-11", "shrink-0", "touch-manipulation")
    const header = back.closest('[data-slot="page-header"]')!
    expect(header).toContainElement(
      screen.getByRole("combobox", { name: /Section/ })
    )
    for (const name of ["Time zone", "Start page"]) {
      expect(screen.getByRole("combobox", { name })).toHaveClass(
        "data-[size=default]:max-md:h-11",
        "touch-manipulation"
      )
    }
  })

  it("gives the Account name box a 44px phone height", async () => {
    renderApp("/settings/account")
    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveClass(
      "max-md:h-11"
    )
  })

  it("has no header bar on desktop", async () => {
    renderApp("/settings")
    await screen.findByRole("link", { name: "Back to app" })
    expect(
      document.querySelector('[data-slot="page-header"]')
    ).not.toBeInTheDocument()
  })
})

function glowButtons() {
  return screen
    .queryAllByRole("button")
    .filter((button) => button.classList.contains("glow"))
}

describe("Settings sections follow their design frames", () => {
  it("groups Export with Sign out under Data and keeps Delete account alone after it", async () => {
    renderApp("/settings/account")
    const data = await screen.findByRole("region", { name: "Data" })
    expect(
      within(data).getByRole("button", { name: "Export" })
    ).toBeInTheDocument()
    expect(
      within(data).getByRole("button", { name: "Sign out" })
    ).toBeInTheDocument()
    expect(
      within(data).queryByRole("button", { name: "Delete account" })
    ).toBeNull()
    const remove = screen.getByRole("button", { name: "Delete account" })
    expect(
      data.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    const profile = screen.getByRole("region", { name: "Profile" })
    expect(
      within(profile).getByRole("button", { name: "Change photo" })
    ).toBeInTheDocument()
    expect(
      within(profile).getByRole("textbox", { name: "Name" })
    ).toBeInTheDocument()
  })

  it("links the Coach usage card to Usage & limits", async () => {
    const user = userEvent.setup()
    renderApp("/settings/coach")
    const link = await screen.findByRole("link", {
      name: /^Usage, (\d+% of this week used|No weekly cap)/,
    })
    expect(link).toHaveAttribute("href", "/settings/usage")
    await user.click(link)
    expect(
      await screen.findByRole("heading", { level: 1, name: "Usage & limits" })
    ).toBeInTheDocument()
  })

  it("keeps Connect an agent and Your agents on Integrations", async () => {
    renderApp("/settings/integrations")
    expect(
      await screen.findByRole("heading", { name: "Your agents" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Integrations" })
    ).toBeInTheDocument()
  })

  it("shows the Free plan and offers, prices or implies no paid plan", async () => {
    renderApp("/settings/billing")
    expect(
      await screen.findByText("You're on the Free plan.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Free plan" })
    ).toBeInTheDocument()
    expect(screen.queryByText(/Upgrade/)).toBeNull()
    expect(screen.queryByText(/\$9/)).toBeNull()
    expect(screen.queryByText(/Cancel anytime/)).toBeNull()
    expect(screen.queryByRole("region", { name: "Payment" })).toBeNull()
    expect(screen.queryByText("Payment method")).toBeNull()
    expect(screen.queryByText("Invoices")).toBeNull()
    expect(screen.queryByRole("button", { name: "Add card" })).toBeNull()
    expect(screen.queryByRole("link", { name: "All plans" })).toBeNull()
  })
})
