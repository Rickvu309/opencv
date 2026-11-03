import { describe, expect, it } from "vitest"

import { keywordPlacement } from "./keyword-placement.ts"

const placed = (before: string, after: string) => {
  const { skip, text } = keywordPlacement(before, after, "Meta Ads")
  return `${before}${after.slice(0, skip)}${text}${after.slice(skip)}`
}

describe("keywordPlacement", () => {
  it("pads a keyword added at the end of a word", () => {
    expect(placed("Second words here", "")).toBe("Second words here Meta Ads")
  })

  it("moves past the rest of a word instead of splitting it", () => {
    expect(placed("Second wo", "rds here")).toBe("Second words Meta Ads here")
  })

  it("pads before a word that starts right after the caret", () => {
    expect(placed("Second ", "words")).toBe("Second Meta Ads words")
  })

  it("adds no space next to spaces, punctuation or the block edge", () => {
    expect(placed("", "")).toBe("Meta Ads")
    expect(placed("I ran (", ").")).toBe("I ran (Meta Ads).")
    expect(placed("Second ", " here")).toBe("Second Meta Ads here")
  })
})
