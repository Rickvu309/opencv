import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ActionCard } from "./action-card"

afterEach(cleanup)

describe("ActionCard", () => {
  it("names a review card by its label and reads the title, state, body and actions inside it", async () => {
    const approve = vi.fn()
    render(
      <ActionCard
        role="region"
        aria-label="Review Coach action"
        icon={<svg data-testid="tile-icon" />}
        title="CV.docx"
        state="1 change to approve"
        actions={
          <button type="button" onClick={approve}>
            Approve
          </button>
        }
      >
        <p>Dear Grace,</p>
      </ActionCard>
    )

    const card = screen.getByRole("region", { name: "Review Coach action" })
    expect(within(card).getByRole("heading", { name: "CV.docx" })).toBeVisible()
    expect(card).toHaveTextContent("CV.docx1 change to approveDear Grace,")
    await userEvent.click(screen.getByRole("button", { name: "Approve" }))
    expect(approve).toHaveBeenCalledOnce()
    expect(
      screen
        .getByText("Dear Grace,")
        .compareDocumentPosition(
          screen.getByRole("button", { name: "Approve" })
        )
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("keeps the tile icon out of the accessible text", () => {
    render(
      <ActionCard
        icon={<svg data-testid="tile-icon" />}
        title="CV.docx"
        state="1 change applied"
      />
    )

    expect(
      screen.getByTestId("tile-icon").closest("[aria-hidden=true]")
    ).not.toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })
})
