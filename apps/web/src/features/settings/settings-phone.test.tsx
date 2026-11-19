import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderApp } from "@/test/render-app.tsx"

afterEach(cleanup)

describe("settings phone layout", () => {
  it("ties a bad name to the Name field", async () => {
    const user = userEvent.setup()
    renderApp("/settings/account")
    const field = await screen.findByRole("textbox", { name: "Name" })
    expect(field).not.toHaveAttribute("aria-invalid")
    expect(field).not.toHaveAttribute("aria-describedby")
    await user.clear(field)
    await user.tab()
    const error = screen.getByRole("alert")
    expect(error).toHaveAttribute("id", "account-name-error")
    expect(error).toHaveTextContent("Enter your name.")
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(field).toHaveAttribute("aria-describedby", "account-name-error")
  })

  it("shows the full time zone name on its value", async () => {
    renderApp("/settings")
    expect(
      await screen.findByText("Language, time zone and where you start.")
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("combobox", { name: "Time zone" })).getByText(
        "Ho Chi Minh City (UTC+7)"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Ho Chi Minh City (UTC+7)")).toHaveAttribute(
      "title",
      "Ho Chi Minh City (UTC+7)"
    )
  })

  it("opens plain-language capabilities and keeps setup tips beside the sign-in step", async () => {
    const user = userEvent.setup()
    renderApp("/settings/integrations")
    const summary = await screen.findByText(
      "Add the server, then sign in. Nothing changes until you approve it in OpenCV."
    )
    expect(summary).toBeVisible()
    expect(screen.queryByText(/paper_read/)).toBeNull()
    const card = screen.getByText("Claude Code").closest("li")
    if (!card) throw new Error("Claude setup card is missing")
    const signIn = within(card).getByRole("button", {
      name: "Copy Claude login command",
    }).parentElement
    expect(signIn?.parentElement).toHaveTextContent(
      "You can also sign in from Claude Code with /mcp."
    )
    await user.click(
      within(card).getByRole("button", {
        name: "What the agent can do",
      })
    )
    expect(
      screen.getByText(
        /Read your CVs and Letters, and propose edits you approve in OpenCV/
      )
    ).toBeVisible()
    expect(screen.queryByText(/paper_read|paper_edit/)).toBeNull()
  })
})
