import { describe, expect, it } from "vitest"

import { receiptHeadline } from "@/features/home/coach-receipt.ts"

import {
  collapsedHunks,
  countChangedLines,
  CREATE_DOC_FIXTURES,
  genericToolPart,
  MOVE_CARD_FIXTURE,
  moveCardSummary,
  UPDATE_CONTENT_FIXTURES,
} from "./fixtures.ts"

describe("coach receipt prototype fixtures", () => {
  it("counts only added and removed lines", () => {
    expect(countChangedLines(UPDATE_CONTENT_FIXTURES.cv.hunks)).toBe(4)
    expect(countChangedLines(UPDATE_CONTENT_FIXTURES.letter.hunks)).toBe(3)
  })

  it("collapses to the first few changes so the receipt stays scannable", () => {
    const collapsed = collapsedHunks(UPDATE_CONTENT_FIXTURES.cv.hunks, 3)
    expect(countChangedLines(collapsed)).toBe(3)
    expect(collapsed[0]?.section).toBe("Summary")
    expect(collapsed.at(-1)?.lines.at(-1)?.kind).toBe("del")
  })

  it("keeps the generic headline the production Thread would show", () => {
    expect(
      receiptHeadline(
        genericToolPart(
          "apply.moveCard",
          MOVE_CARD_FIXTURE.summary,
          true,
          MOVE_CARD_FIXTURE.reversal
        )
      )
    ).toBe(
      "Ran apply.moveCard — Moved Associate PM intern at Local startup to Prep"
    )
    expect(
      receiptHeadline(
        genericToolPart("paper.createDoc", CREATE_DOC_FIXTURES.cv.summary, true)
      )
    ).toBe("Ran paper.createDoc — Created CV Untitled CV")
    expect(
      moveCardSummary({
        title: MOVE_CARD_FIXTURE.title,
        company: MOVE_CARD_FIXTURE.company,
        to: "sent",
      })
    ).toBe("Moved Associate PM intern at Local startup to Sent")
  })
})
