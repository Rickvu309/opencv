import { createElement, useState } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { RECEIPT_ENTER_STAGGER_MS } from "@/features/coach/coach-working.tsx"
import { STREAMING_COACH_ID } from "@/features/home/threads.ts"
import { ThreadView } from "@/features/home/thread-view.tsx"

afterEach(() => {
  cleanup()
})

const moveReceipt = {
  type: "tool" as const,
  name: "apply_moveCard",
  summary: "Moved 'Backend Intern' to Prep",
  ok: true,
  toolCallId: "call-1",
  reversal: {
    possible: true,
    description: "Undo by moving the card back.",
    command: "apply.moveCard",
    input: { cardId: "c1", stage: "inbox" },
  },
}

const createReceipt = {
  type: "tool" as const,
  name: "paper_createDoc",
  summary: "Created CV Untitled CV",
  ok: true,
  toolCallId: "call-2",
}

describe("ThreadView Coach motion", () => {
  it("shows Working… with a thin bar and no pulse dots", () => {
    render(createElement(ThreadView, { messages: [], waiting: true }))

    const status = screen.getByRole("status", { name: "Coach is working" })
    expect(status).toHaveTextContent("Working…")
    expect(
      status.querySelector("[data-slot='coach-working-bar']")
    ).toBeInTheDocument()
    expect(status.querySelector(".animate-pulse")).not.toBeInTheDocument()
    expect(status.textContent).not.toMatch(/\.\s*\.\s*\./)
  })

  it("fades in first coach text and staggers receipt enter on the live turn", () => {
    render(
      createElement(ThreadView, {
        messages: [
          {
            id: STREAMING_COACH_ID,
            role: "coach",
            text: "Moved it and started a CV.",
            parts: [
              { type: "text", text: "Moved it and started a CV." },
              moveReceipt,
              createReceipt,
            ],
          },
        ],
      })
    )

    expect(screen.getByRole("log", { name: "Thread" }).firstElementChild).toHaveAttribute(
      "data-coach-text-enter",
      "true"
    )
    const receipts = screen.getAllByRole("status", { name: "Command succeeded" })
    expect(receipts).toHaveLength(2)
    expect(receipts[0]).toHaveAttribute("data-coach-receipt-enter", "true")
    expect(receipts[1]).toHaveAttribute("data-coach-receipt-enter", "true")
    expect(receipts[0]).not.toHaveStyle({ animationDelay: `${RECEIPT_ENTER_STAGGER_MS}ms` })
    expect(receipts[1]).toHaveStyle({
      animationDelay: `${RECEIPT_ENTER_STAGGER_MS}ms`,
    })
  })

  it("does not enter-animate persisted coach turns", () => {
    render(
      createElement(ThreadView, {
        messages: [
          {
            id: "coach-1",
            role: "coach",
            text: "Moved it.",
            parts: [
              { type: "text", text: "Moved it." },
              moveReceipt,
            ],
          },
        ],
      })
    )

    expect(
      screen.getByRole("log", { name: "Thread" }).querySelector("[data-coach-text-enter]")
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("status", { name: "Command succeeded" })
    ).not.toHaveAttribute("data-coach-receipt-enter")
  })

  it("collapses an undone receipt and flashes Undone on the replacement", async () => {
    function Harness() {
      const [undone, setUndone] = useState(false)
      const parts = undone
        ? [
            { type: "text" as const, text: "Moved it." },
            { ...moveReceipt, undone: true },
            {
              type: "tool" as const,
              name: "apply_moveCard",
              summary: "Undid the previous action",
              ok: true,
              toolCallId: "call-undo",
            },
          ]
        : [{ type: "text" as const, text: "Moved it." }, moveReceipt]
      return createElement(ThreadView, {
        messages: [
          { id: "coach-1", role: "coach", text: "Moved it.", parts },
        ],
        onUndo: async () => {
          setUndone(true)
        },
      })
    }

    render(createElement(Harness))
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(await screen.findByText("Undid the previous action")).toBeInTheDocument()
    expect(
      screen.getAllByRole("status", { name: "Command succeeded" })[0]
    ).toHaveAttribute("data-coach-receipt-collapse", "true")
    expect(screen.getByText("Undone")).toBeInTheDocument()
  })
})
