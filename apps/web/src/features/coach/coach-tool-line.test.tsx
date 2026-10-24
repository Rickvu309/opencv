import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ThreadToolPart } from "@workspace/domain"

import {
  CoachToolLine,
  UNDO_FAILED_COPY,
} from "@/features/coach/coach-tool-line.tsx"

afterEach(() => {
  cleanup()
})

const moved: ThreadToolPart = {
  type: "tool",
  name: "apply_moveCard",
  summary: "Moved a card",
  ok: true,
  toolCallId: "call-1",
  detail: {
    type: "apply.moveCard",
    cardId: "c1",
    title: "Backend Intern",
    company: "Acme",
    from: "inbox",
    to: "prep",
  },
  reversal: {
    possible: true,
    description: "Undo by moving the card back.",
    command: "apply.moveCard",
    input: { cardId: "c1", stage: "inbox" },
  },
}

describe("CoachToolLine", () => {
  it("names the object the step changed and what undoes it", () => {
    render(<CoachToolLine part={moved} canUndo={false} />)

    const line = screen.getByRole("status", { name: "Command succeeded" })
    expect(line).toHaveTextContent(
      "Moved Backend Intern at Acme from Inbox to Prep"
    )
    expect(line).toHaveTextContent("Undo by moving the card back.")
  })

  it("says nothing changed when a step failed", () => {
    render(
      <CoachToolLine
        part={{ ...moved, ok: false, summary: "Card not found" }}
        canUndo={false}
      />
    )

    const line = screen.getByRole("status", { name: "Command failed" })
    expect(line).toHaveTextContent("Nothing changed.")
  })

  it("shows a sentence, not the raw error, when Undo fails", async () => {
    const onUndo = vi.fn().mockRejectedValue(new Error("SQLSTATE 40001"))
    render(<CoachToolLine part={moved} canUndo onUndo={onUndo} />)

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(UNDO_FAILED_COPY)
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
  })
})
