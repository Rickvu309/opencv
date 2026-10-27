import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { renderApp } from "@/test/render-app.tsx"
import {
  scriptCoachStream,
  setMockCoachUsage,
} from "@/test/threads-api-mock.ts"

afterEach(() => {
  cleanup()
})

describe("coach free cap", () => {
  it("names the reset time, disables the composer, and glows Upgrade", async () => {
    setMockCoachUsage({
      plan: "free",
      mode: "free",
      caps: { free: 2, light: 10, max: 5 },
      day: {
        capped: true,
        used: 2,
        cap: 2,
        remaining: 0,
        resetsAt: "2026-10-28T00:00:00.000Z",
      },
    })
    renderApp("/app/coach")
    expect(
      await screen.findByText("You've reached today's Free limit")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Resets at 7:00. Pro has unlimited Coach chats.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Upgrade" })).toBeInTheDocument()
    const field = screen.getByRole("textbox", { name: "Message Coach" })
    expect(field).toBeDisabled()
    expect(field).toHaveAttribute("placeholder", "Coach is back at 7:00")
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Upgrade" })).toHaveAttribute(
      "data-variant",
      "glow"
    )
    expect(glowCount()).toBe(1)
  })

  it("shows the same banner after a 429 and no second error", async () => {
    scriptCoachStream({
      httpError: {
        status: 429,
        code: "COACH_LIMIT_REACHED",
        message: "raw limit text",
      },
    })
    renderApp("/app/coach")
    const field = await screen.findByRole("textbox", { name: "Message Coach" })
    fireEvent.change(field, { target: { value: "One more turn" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => {
      expect(
        screen.getByText("You've reached today's Free limit")
      ).toBeInTheDocument()
    })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByText("raw limit text")).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Message Coach" })).toHaveValue(
      "One more turn"
    )
    expect(screen.getByRole("button", { name: "Upgrade" })).toHaveAttribute(
      "data-variant",
      "glow"
    )
    expect(glowCount()).toBe(1)
  })

  it("keeps the composer open while the metered day still has turns left", async () => {
    setMockCoachUsage({
      plan: "free",
      mode: "free",
      caps: { free: 2, light: 10, max: 5 },
      day: {
        capped: true,
        used: 0,
        cap: 2,
        remaining: 2,
        resetsAt: "2026-10-28T00:00:00.000Z",
      },
    })
    renderApp("/app/coach")
    expect(
      await screen.findByRole("heading", { name: "How can I help?" })
    ).toBeInTheDocument()
    expect(
      screen.queryByText("You've reached today's Free limit")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Message Coach" })).toBeEnabled()
  })
})

function glowCount() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("data-variant") === "glow").length
}
