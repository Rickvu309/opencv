import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { renderApp } from "@/test/render-app.tsx"
import { setMockCoachUsage } from "@/test/threads-api-mock.ts"

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
  })
})
