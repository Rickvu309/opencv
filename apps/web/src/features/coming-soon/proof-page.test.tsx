import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { ProofsPage } from "@/features/coming-soon/proof-page.tsx"

const state = vi.hoisted(() => ({
  pending: false,
  error: null as string | null,
  notify: vi.fn(),
}))

vi.mock("@/features/coming-soon/notify.ts", () => ({
  useNotify: () => state,
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string
    children: ReactNode
    className?: string
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
  state.pending = false
  state.error = null
  state.notify.mockReset()
})

describe("Proofs coming soon", () => {
  it("shows the Paper to Proofs breadcrumb as the page title", () => {
    render(<ProofsPage />)

    const title = screen.getByRole("heading", { level: 1 })
    expect(title).toHaveTextContent("Paper")
    expect(title).toHaveTextContent("Proofs")
    expect(screen.getByRole("link", { name: "Paper" })).toHaveAttribute(
      "href",
      "/paper"
    )
  })

  it("leads with the headline, the badge and the sub line", () => {
    render(<ProofsPage />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Back your CV with proof" })
    ).toBeInTheDocument()
    expect(screen.getByText("Coming soon")).toBeInTheDocument()
    expect(
      screen.getByText("Turn a CV line into evidence.")
    ).toBeInTheDocument()
  })

  it("asks to be notified when the button is pressed", () => {
    render(<ProofsPage />)

    fireEvent.click(screen.getByRole("button", { name: "Get early access" }))

    expect(state.notify).toHaveBeenCalledTimes(1)
  })

  it("shows an error next to the button", () => {
    state.error = "Could not save that. Try again."
    render(<ProofsPage />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save that. Try again."
    )
  })

  it("hides the decorative chart from the accessibility tree", () => {
    render(<ProofsPage />)

    expect(
      screen.queryByRole("heading", { name: /38%/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Manager confirmed").closest("[aria-hidden='true']")
    ).not.toBeNull()
  })
})
