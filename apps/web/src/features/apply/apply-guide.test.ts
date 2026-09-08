import { describe, expect, it } from "vitest"

import {
  STARTER_GUIDED_APPLY_COMPANY,
  STARTER_GUIDED_APPLY_TITLE,
} from "@workspace/domain"

import { sampleApplyCards } from "@/test/apply-fixtures.ts"

import {
  GUIDED_APPLY_PREP_ACTION,
  guidedApplyNextAction,
  pickGuidedApplyCard,
} from "./apply-guide.ts"

describe("guided Apply first action", () => {
  it("pokes the seeded inbox card and leaves the rest of the board", () => {
    const cards = sampleApplyCards()
    const before = cards.map((card) => card.id)
    const picked = pickGuidedApplyCard(cards)

    expect(picked?.title).toBe(STARTER_GUIDED_APPLY_TITLE)
    expect(picked?.company).toBe(STARTER_GUIDED_APPLY_COMPANY)
    expect(picked?.stage).toBe("inbox")
    expect(picked?.starred).toBe(true)
    expect(guidedApplyNextAction(picked!)).toEqual({
      kind: "stage",
      stage: "prep",
      label: "Prep",
    })
    expect(GUIDED_APPLY_PREP_ACTION).toBe("Move to Prep")
    expect(cards.map((card) => card.id)).toEqual(before)
    expect(cards).toHaveLength(5)
    expect(cards.filter((card) => card.id !== picked?.id).length).toBe(4)
  })

  it("falls back to another inbox or prep card instead of inventing one", () => {
    const cards = sampleApplyCards().filter(
      (card) => card.title !== STARTER_GUIDED_APPLY_TITLE
    )
    const inbox = pickGuidedApplyCard(cards)
    expect(inbox?.stage).toBe("inbox")
    expect(inbox?.title).toBe("Product intern")
    expect(guidedApplyNextAction(inbox!)).toEqual({
      kind: "stage",
      stage: "prep",
      label: "Prep",
    })

    const prepOnly = cards.filter((card) => card.stage === "prep")
    const prep = pickGuidedApplyCard(prepOnly)
    expect(prep?.title).toBe("Business analyst intern")
    expect(guidedApplyNextAction(prep!)).toEqual({
      kind: "track",
      trackKind: "followup",
      label: "Follow-up",
    })

    expect(
      pickGuidedApplyCard(cards.filter((card) => card.stage === "sent"))
    ).toBeNull()
    expect(pickGuidedApplyCard([])).toBeNull()
  })
})
