import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ChatToolPart } from "@workspace/domain/coach"

import { ApiError } from "@/lib/api-error.ts"
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

const moved: ChatToolPart = {
  type: "tool",
  name: "job.move",
  summary: "Moved a card",
  ok: true,
  toolCallId: "call-1",
  activityId: "act-1",
  detail: {
    type: "job.move",
    title: "Backend Intern",
    company: "Acme",
    from: "inbox",
    to: "prep",
  },
  reversal: {
    possible: true,
    description: "Undo by moving the card back.",
    command: "job.move",
    input: { cardId: "c1", stage: "inbox" },
  },
}

function toolOf(part: ChatToolPart): CoachToolPart {
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

    expect(
      screen.getByRole("heading", {
        name: "Moved Backend Intern at Acme from inbox to prep",
      })
    ).toBeVisible()
    expect(screen.getByText("Done")).toBeVisible()
    expect(screen.getByText(/Undo by moving the card back\./)).toBeVisible()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("says nothing changed and announces the error when a step failed", () => {
    render(
      <CoachToolLine
        tool={toolOf({ ...moved, ok: false, summary: "Card not found" })}
        canUndo
        onUndo={vi.fn()}
      />
    )

    expect(
      screen.getByRole("heading", { name: /Card not found/ })
    ).toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent(
      "Failed. Nothing changed."
    )
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
  })

  it("shows no running timer on a finished step", () => {
    vi.useFakeTimers()
    const { container } = render(
      <CoachToolLine tool={toolOf(moved)} canUndo={false} />
    )
    const before = container.textContent
    vi.advanceTimersByTime(5000)
    expect(container.textContent).toBe(before)
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

  it("shows why Undo was refused", async () => {
    const reason =
      "This Word document changed after the edit, so Undo was skipped."
    const onUndo = vi
      .fn()
      .mockRejectedValue(new ApiError(409, "CONFLICT", reason))
    render(<CoachToolLine tool={toolOf(moved)} canUndo onUndo={onUndo} />)

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(reason)
    expect(screen.queryByText(UNDO_FAILED_COPY)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
  })

  it("shows why Undo was refused when the page moved after the save", async () => {
    const reason = "This page changed after that save, so Undo was skipped."
    const onUndo = vi
      .fn()
      .mockRejectedValue(new ApiError(409, "CONFLICT", reason))
    render(<CoachToolLine tool={toolOf(moved)} canUndo onUndo={onUndo} />)

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(reason)
    expect(screen.queryByText(UNDO_FAILED_COPY)).not.toBeInTheDocument()
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
