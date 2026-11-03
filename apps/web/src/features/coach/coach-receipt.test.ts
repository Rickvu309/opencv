import { describe, expect, it } from "vitest"

import {
  namedReceiptHeadline,
  receiptHeadline,
  receiptReversalNote,
  receiptShowsUndo,
} from "@/features/coach/coach-receipt.ts"

describe("receiptHeadline", () => {
  it("uses a named headline for graduated receipts and drops Ran", () => {
    expect(
      receiptHeadline({
        type: "tool",
        name: "job.move",
        summary: "Moved Associate PM intern at Local startup to Prep",
        ok: true,
        detail: {
          type: "job.move",
          title: "Associate PM intern",
          company: "Local startup",
          from: "inbox",
          to: "prep",
        },
      })
    ).toBe("Moved Associate PM intern at Local startup from inbox to prep")
    expect(
      receiptHeadline({
        type: "tool",
        name: "job.list",
        summary: "Listed 2 Apply cards",
        ok: true,
      })
    ).toBe("Listed 2 Apply cards")
  })

  it("keeps failure summaries as one plain line", () => {
    expect(
      receiptHeadline({
        type: "tool",
        name: "job.move",
        summary: "Apply card not found",
        ok: false,
      })
    ).toBe("Apply card not found")
  })

  it("rewrites a Zod dump into a short fail sentence", () => {
    const headline = receiptHeadline({
      type: "tool",
      name: "job.move",
      summary:
        'Invalid input for tool apply_moveCard: Type validation failed: Value: {"cardId":"00000000-0000-0000-0000-000000000002"}. Error message: [{"code":"invalid_format","pattern":"/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}$/","message":"Invalid UUID"}]',
      ok: false,
    })
    expect(headline).toBe("That card id isn't valid")
    expect(headline).not.toMatch(
      /Invalid input|Type validation|Invalid UUID|\{|\/\^/
    )
  })

  it("names the three graduated Commands", () => {
    expect(
      namedReceiptHeadline({
        type: "paper.replace",
        docKind: "cv",
        docName: "PM track CV",
        hunks: [],
      })
    ).toBe("Updated CV PM track CV")
    expect(
      namedReceiptHeadline({
        type: "paper.create",
        docKind: "letter",
        name: "Untitled Letter",
        status: "draft",
      })
    ).toBe("Created Letter Untitled Letter")
  })
})

describe("receipt reversal helpers", () => {
  it("shows a one-click undo only when the receipt is reversible", () => {
    expect(
      receiptShowsUndo({
        type: "tool",
        name: "job.move",
        summary: "Moved it",
        ok: true,
        toolCallId: "call_1",
        activityId: "act_1",
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
          command: "job.move",
          input: { cardId: "c1", stage: "inbox" },
        },
      })
    ).toBe(true)
    expect(
      receiptShowsUndo({
        type: "tool",
        name: "job.list",
        summary: "Listed cards",
        ok: true,
        toolCallId: "call_2",
        reversal: {
          possible: false,
          description: "This read does not change anything.",
        },
      })
    ).toBe(false)
    expect(
      receiptShowsUndo({
        type: "tool",
        name: "job.move",
        summary: "Moved it",
        ok: true,
        toolCallId: "call_3",
        activityId: "act_3",
        undone: true,
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
        },
      })
    ).toBe(false)
  })

  it("shows no undo without an activity id to reverse", () => {
    expect(
      receiptShowsUndo({
        type: "tool",
        name: "paper.rename",
        summary: "Renamed it",
        ok: true,
        toolCallId: "call_4",
        reversal: { possible: true, description: "Rename it back." },
      })
    ).toBe(false)
  })

  it("keeps irreversible receipts as read-only notes", () => {
    expect(
      receiptReversalNote({
        type: "tool",
        name: "job.list",
        summary: "Listed cards",
        ok: true,
        reversal: {
          possible: false,
          description: "This read does not change anything.",
        },
      })
    ).toBe("This read does not change anything.")
    expect(
      receiptReversalNote({
        type: "tool",
        name: "job.move",
        summary: "Moved it",
        ok: true,
        activityId: "11111111-1111-4111-8111-111111111111",
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
        },
      })
    ).toBe("Reversible — Undo by moving the card back.")
  })

  it("never says Reversible when there is no history row to undo", () => {
    const part = {
      type: "tool" as const,
      name: "job.star" as const,
      summary: "Starred it",
      ok: true,
      reversal: {
        possible: true,
        description: "Unstar it.",
      },
    }
    expect(receiptShowsUndo(part)).toBe(false)
    expect(receiptReversalNote(part)).toBeNull()
  })
})

describe("a receipt whose edit the server says cannot be undone now", () => {
  const blocked = {
    type: "tool" as const,
    name: "paper.edit" as const,
    summary: "Edited CV",
    ok: true,
    activityId: "11111111-1111-4111-8111-111111111111",
    reversal: {
      possible: false,
      description: "Undo the newer Coach edit first.",
    },
  }

  it("offers no Undo and states why", () => {
    expect(receiptShowsUndo(blocked)).toBe(false)
    expect(receiptReversalNote(blocked)).toBe(
      "Undo the newer Coach edit first."
    )
  })
})
