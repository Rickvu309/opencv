import { describe, expect, it } from "vitest"

import {
  findHighlight,
  nextHighlightId,
  nextSlideIndex,
  prevHighlightId,
  prevSlideIndex,
} from "@/features/pitch/pitch-story-utils.ts"
import { starterPitchDocument } from "@workspace/domain"

describe("pitch story navigation", () => {
  it("walks slides then highlights", () => {
    const highlights = starterPitchDocument().storyHighlights
    const first = highlights[0]!
    const second = highlights[1]!

    expect(findHighlight(highlights, first.id)?.id).toBe(first.id)
    expect(nextSlideIndex(first, 0)).toBe(1)
    expect(nextSlideIndex(first, first.slides.length - 1)).toBeNull()
    expect(prevSlideIndex(0)).toBeNull()
    expect(prevSlideIndex(1)).toBe(0)
    expect(nextHighlightId(highlights, first.id)).toBe(second.id)
    expect(prevHighlightId(highlights, second.id)).toBe(first.id)
    expect(
      nextHighlightId(highlights, highlights[highlights.length - 1]!.id)
    ).toBeNull()
  })
})
