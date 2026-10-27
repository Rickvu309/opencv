import { describe, expect, it } from "vitest"

import {
  commandNameFromTool,
  namedReceiptHeadline,
  receiptHeadline,
  receiptReversalNote,
  receiptShowsUndo,
} from "@/features/home/coach-receipt.ts"

describe("receiptHeadline", () => {
  it("uses a named headline for graduated receipts and drops Ran", () => {
    expect(commandNameFromTool("apply_moveCard")).toBe("apply.moveCard")
    expect(
      receiptHeadline({
        type: "tool",
        name: "apply_moveCard",
        summary: "Moved Associate PM intern at Local startup to Prep",
        ok: true,
        detail: {
          type: "apply.moveCard",
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
        name: "job_list",
        summary: "Listed 2 Apply cards",
        ok: true,
      })
    ).toBe("Listed 2 Apply cards")
  })

  it("keeps failure summaries as one plain line", () => {
    expect(
      receiptHeadline({
        type: "tool",
        name: "apply_moveCard",
        summary: "Apply card not found",
        ok: false,
      })
    ).toBe("Apply card not found")
  })

  it("rewrites a Zod dump into a short fail sentence", () => {
    const headline = receiptHeadline({
      type: "tool",
      name: "apply_moveCard",
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
        type: "paper.updateContent",
        docKind: "cv",
        docName: "PM track CV",
        hunks: [],
      })
    ).toBe("Updated CV PM track CV")
    expect(
      namedReceiptHeadline({
        type: "paper.createDoc",
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
        name: "apply_moveCard",
        summary: "Moved it",
        ok: true,
        toolCallId: "call_1",
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
          command: "apply.moveCard",
          input: { cardId: "c1", stage: "inbox" },
        },
      })
    ).toBe(true)
    expect(
      receiptShowsUndo({
        type: "tool",
        name: "job_list",
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
        name: "apply_moveCard",
        summary: "Moved it",
        ok: true,
        toolCallId: "call_3",
        undone: true,
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
        },
      })
    ).toBe(false)
  })

  it("keeps irreversible receipts as read-only notes", () => {
    expect(
      receiptReversalNote({
        type: "tool",
        name: "job_list",
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
        name: "apply_moveCard",
        summary: "Moved it",
        ok: true,
        reversal: {
          possible: true,
          description: "Undo by moving the card back.",
        },
      })
    ).toBe("Reversible — Undo by moving the card back.")
  })
})
