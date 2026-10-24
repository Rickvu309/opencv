import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { Confirmation } from "@/components/ai-elements/confirmation.tsx"

afterEach(() => {
  cleanup()
})

describe("Confirmation", () => {
  it("approves or denies a step by button name", () => {
    const onApprove = vi.fn()
    const onDeny = vi.fn()
    render(
      <Confirmation
        title="Update your CV"
        detail="Rewrites the summary."
        onApprove={onApprove}
        onDeny={onDeny}
      />
    )

    expect(
      screen.getByRole("group", { name: "Confirm Coach step" })
    ).toHaveTextContent("Rewrites the summary.")
    fireEvent.click(screen.getByRole("button", { name: "Deny" }))
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    expect(onDeny).toHaveBeenCalledOnce()
    expect(onApprove).toHaveBeenCalledOnce()
  })

  it("disables both answers while pending", () => {
    render(
      <Confirmation
        title="Update"
        onApprove={vi.fn()}
        onDeny={vi.fn()}
        pending
      />
    )

    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Deny" })).toBeDisabled()
  })
})
