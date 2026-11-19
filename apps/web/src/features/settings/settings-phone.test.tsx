import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderApp } from "@/test/render-app.tsx"

afterEach(cleanup)

describe("settings phone layout", () => {
  it("keeps the name box at 16px on a phone and ties a bad name to the field", async () => {
    const user = userEvent.setup()
    renderApp("/settings/account")
    const field = await screen.findByRole("textbox", { name: "Name" })
    expect(field).toHaveClass("text-base", "md:text-[13px]")
    expect(field.className).not.toMatch(/(?:^|\s)text-\[13px\](?:\s|$)/)
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

  it("stacks every preference when the settings column is under 480px", async () => {
    renderApp("/settings")
    expect(
      await screen.findByText("Language, time zone and where you start.")
    ).toBeInTheDocument()
    expect(document.querySelector('[data-slot="settings-column"]')).toHaveClass(
      "@container/settings"
    )
    const language = document.querySelector(
      '[data-row="language"] [data-slot="settings-row-body"]'
    )
    expect(language).toHaveClass(
      "@max-[479px]/settings:flex-col",
      "@max-[479px]/settings:gap-3"
    )
    expect(
      document.querySelector(
        '[data-row="language"] [data-slot="settings-row-desc"]'
      )
    ).toHaveClass("@max-[479px]/settings:leading-[18px]")
    expect(
      document.querySelector(
        '[data-row="time-zone"] [data-slot="select-trigger"]'
      )
    ).toHaveClass(
      "@max-[479px]/settings:w-full",
      "@max-[479px]/settings:min-w-0"
    )
    expect(
      document.querySelector(
        '[data-row="start-page"] [data-slot="settings-row-body"]'
      )
    ).toHaveClass(
      "@max-[479px]/settings:flex-col",
      "@max-[479px]/settings:gap-3"
    )
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
    expect(summary).toHaveClass("max-w-[60ch]")
    expect(screen.queryByText(/paper_read/)).toBeNull()
    const card = screen.getByText("Claude Code").closest("li")
    if (!card) throw new Error("Claude setup card is missing")
    const signIn = within(card)
      .getByRole("button", { name: "Copy Claude login command" })
      .closest("[data-slot=code-block]")
    expect(signIn).toHaveTextContent("claude mcp login opencv")
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
