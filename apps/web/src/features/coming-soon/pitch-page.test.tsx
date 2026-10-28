import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { PitchPage } from "@/features/coming-soon/pitch-page.tsx"

const state = vi.hoisted(() => ({
  pending: false,
  error: null as string | null,
  notify: vi.fn(),
}))

vi.mock("@/features/coming-soon/notify.ts", () => ({
  useNotify: () => state,
}))

afterEach(() => {
  cleanup()
  state.pending = false
  state.error = null
  state.notify.mockReset()
})

describe("Pitch coming soon", () => {
  it("titles the page Pitch and reads the headline as one sentence", () => {
    render(<PitchPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Pitch" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "One link that sells you" })
    ).toBeInTheDocument()
    expect(screen.getByText("Coming soon")).toBeInTheDocument()
  })

  it("asks to be notified when the button is pressed", () => {
    render(<PitchPage />)

    fireEvent.click(screen.getByRole("button", { name: "Get early access" }))

    expect(state.notify).toHaveBeenCalledTimes(1)
  })

  it("shows an error next to the button", () => {
    state.error = "Could not save that. Try again."
    render(<PitchPage />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save that. Try again."
    )
  })

  it("hides the decorative mock from the accessibility tree", () => {
    render(<PitchPage />)

    expect(
      screen.queryByRole("button", { name: "Download CV" })
    ).not.toBeInTheDocument()
    expect(
      screen
        .getByText("Hanh Tran opened your Pitch")
        .closest("[aria-hidden='true']")
    ).not.toBeNull()
  })
})
