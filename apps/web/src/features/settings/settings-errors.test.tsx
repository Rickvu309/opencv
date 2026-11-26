import { useReducer } from "react"
import type { Profile } from "@workspace/domain/account"
import { afterEach, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"

import { authClient } from "@/lib/auth-client.ts"
import { profileKey } from "@/lib/account-api.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { renderApp, renderPage } from "@/test/render-app.tsx"
import { AccountSection } from "./account-section.tsx"
import { SettingsRow } from "./settings-layout.tsx"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each(["language", "time-zone", "start-page", "memory", "profile"])(
  "links the %s error to its control group and clears the association on recovery",
  (id) => {
    const { rerender } = render(
      <SettingsRow
        id={id}
        label="Setting"
        error="Try again."
        control={<button>Change</button>}
      />
    )
    const group = screen.getByRole("group", { name: "Setting" })
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toHaveAccessibleDescription("Try again.")
    expect(screen.getByRole("alert")).toHaveAttribute(
      "id",
      group.getAttribute("aria-describedby")
    )
    expect(group).toContainElement(
      screen.getByRole("button", { name: "Change" })
    )
    rerender(
      <SettingsRow id={id} label="Setting" control={<button>Change</button>} />
    )
    expect(group).not.toHaveAttribute("aria-invalid")
    expect(group).not.toHaveAttribute("aria-describedby")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  }
)

it.each([
  {
    route: "/settings/usage",
    title: "Usage & limits",
    key: catalogClient.key("user_test", "coach.usage", {}),
  },
  {
    route: "/settings/billing",
    title: "Billing",
    key: catalogClient.key("user_test", "billing.get", {}),
  },
])(
  "keeps $title and Try again on a load failure",
  async ({ route, title, key }) => {
    const { queryClient } = renderApp(route)
    await screen.findByRole("heading", { name: title, level: 1 })
    await screen.findByText("You're on the Free plan.")
    const query = queryClient.getQueryCache().find({ queryKey: key })
    if (!query) throw new Error("The settings read must be loaded")
    act(() => query.setState({ status: "error", error: new Error("Offline") }))
    expect(screen.getByRole("heading", { name: title, level: 1 })).toBeVisible()
    expect(
      await screen.findByRole("button", { name: "Try again" })
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await screen.findByText("You're on the Free plan.")
  }
)

it("keeps Name focusable during a save without submitting another change", async () => {
  const { queryClient } = renderApp("/settings/account")
  await screen.findByRole("textbox", { name: "Name" })
  const profile = queryClient.getQueryData<Profile>(profileKey("user_test"))
  if (!profile) throw new Error("Account must have a profile")
  const savedProfile = profile
  cleanup()
  const save = vi.fn()
  function SavingAccount() {
    const [pending, startSaving] = useReducer(
      (_: boolean, action: "save") => action === "save",
      false
    )
    return (
      <AccountSection
        profile={savedProfile}
        pending={pending}
        onSave={(patch) => {
          save(patch)
          startSaving("save")
        }}
      />
    )
  }
  renderPage(SavingAccount)
  const field = await screen.findByRole("textbox", { name: "Name" })
  fireEvent.change(field, { target: { value: "New name" } })
  fireEvent.blur(field)
  expect(save).toHaveBeenCalledExactlyOnceWith({ name: "New name" })
  expect(field).toHaveAttribute("readonly")
  expect(field).not.toBeDisabled()
  field.focus()
  expect(field).toHaveFocus()
  fireEvent.blur(field)
  expect(save).toHaveBeenCalledTimes(1)
})

it("links a refused email code to its group and marks every digit invalid", async () => {
  vi.mocked(authClient.emailOtp.changeEmail).mockResolvedValueOnce({
    data: null,
    error: {
      message: "Enter a new code.",
      status: 400,
      statusText: "Bad Request",
    },
  })
  renderApp("/settings/account")
  fireEvent.click(await screen.findByRole("button", { name: "Change email" }))
  const dialog = await screen.findByRole("dialog")
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Email" }), {
    target: { value: "next@example.com" },
  })
  fireEvent.click(within(dialog).getByRole("button", { name: "Change email" }))
  const digit = await within(dialog).findByRole("textbox", { name: "Digit 1" })
  expect(digit).not.toHaveAttribute("aria-invalid")
  fireEvent.change(digit, { target: { value: "123456" } })
  await within(dialog).findByText("Enter a new code.")
  expect(
    within(dialog).getByRole("group", { name: "Verification code" })
  ).toHaveAccessibleDescription("Enter a new code.")
  for (let index = 1; index <= 6; index += 1) {
    expect(
      within(dialog).getByRole("textbox", { name: `Digit ${index}` })
    ).toHaveAttribute("aria-invalid", "true")
  }
})
