import { describe, expect, it } from "vitest"

import { previewMove } from "./apply-board-drops.ts"

const cards = [
  { id: "a", column: "saved" },
  { id: "b", column: "saved" },
  { id: "c", column: "applied" },
]

describe("drag preview", () => {
  it("shows the dragged card at the end of the column it is over, where it will land", () => {
    expect(previewMove(cards, "a", "applied")).toEqual([
      { id: "b", column: "saved" },
      { id: "c", column: "applied" },
      { id: "a", column: "applied" },
    ])
  })

  it("leaves the board alone over the card's own column or for an unknown card", () => {
    expect(previewMove(cards, "a", "saved")).toEqual(cards)
    expect(previewMove(cards, "zz", "applied")).toEqual(cards)
  })
})
