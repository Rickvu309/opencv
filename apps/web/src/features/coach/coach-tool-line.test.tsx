import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ThreadToolPart } from "@workspace/domain"

import {
  CoachToolLine,
  UNDO_FAILED_COPY,
} from "@/features/coach/coach-tool-line.tsx"
import {
  toCoachParts,
  type CoachToolPart,
} from "@/features/coach/coach-parts.ts"

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

function toolOf(part: ThreadToolPart): CoachToolPart {
  const found = toCoachParts({
    id: "m1",
    role: "coach",
    text: "",
    parts: [part],
  }).find((item) => item.kind === "tool")
  if (!found || found.kind !== "tool") throw new Error("no tool part")
  return found
}

describe("CoachToolLine", () => {
  it("names the object the step changed and what undoes it", () => {
    render(<CoachToolLine tool={toolOf(moved)} canUndo={false} />)

    const header = screen.getByRole("button", {
      name: /Moved Backend Intern at Acme from inbox to prep/,
    })
    expect(header).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.getByText(
        /^Moved Backend Intern at Acme from inbox to prep finished/
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Undo by moving the card back\./)).toBeVisible()
  })

  it("opens the result when the header is activated", () => {
    render(<CoachToolLine tool={toolOf(moved)} canUndo={false} />)

    const header = screen.getByRole("button", { name: /Moved Backend Intern/ })
    fireEvent.click(header)

    expect(header).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Result")).toBeInTheDocument()
    expect(screen.getByText("Moved a card")).toBeInTheDocument()
  })

  it("says nothing changed and announces the error when a step failed", () => {
    render(
      <CoachToolLine
        tool={toolOf({ ...moved, ok: false, summary: "Card not found" })}
        canUndo={false}
      />
    )

    expect(
      screen.getByText(/Card not found failed: Nothing changed\./)
    ).toHaveAttribute("aria-live", "polite")
    expect(screen.getByRole("button", { name: /Failed/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(screen.getByText("Nothing changed.")).toBeInTheDocument()
  })

  it("shows no running timer on a finished step", () => {
    vi.useFakeTimers()
    render(<CoachToolLine tool={toolOf(moved)} canUndo={false} />)
    const before = screen.getByRole("button", {
      name: /Moved Backend Intern/,
    }).textContent
    vi.advanceTimersByTime(5000)
    expect(
      screen.getByRole("button", { name: /Moved Backend Intern/ }).textContent
    ).toBe(before)
    vi.useRealTimers()
  })

  it("shows a sentence, not the raw error, when Undo fails", async () => {
    const onUndo = vi.fn().mockRejectedValue(new Error("SQLSTATE 40001"))
    render(<CoachToolLine tool={toolOf(moved)} canUndo onUndo={onUndo} />)

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(UNDO_FAILED_COPY)
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
  })

  it("replaces Undo with Undone once the step was reversed", () => {
    render(
      <CoachToolLine
        tool={toolOf({ ...moved, undone: true })}
        canUndo
        onUndo={vi.fn()}
      />
    )

    expect(screen.getByText("Undone")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Undo" })
    ).not.toBeInTheDocument()
  })
})
