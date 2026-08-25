import { describe, expect, it } from "vitest"

import {
  findHighlight,
  nextHighlightId,
  nextSlideIndex,
  prevHighlightId,
  prevSlideIndex,
} from "@/features/pitch/pitch-story-utils.ts"
import { PITCH_STORY_HIGHLIGHTS } from "@/features/pitch/pitch-types.ts"

describe("pitch story navigation", () => {
  it("walks slides then highlights", () => {
    const first = PITCH_STORY_HIGHLIGHTS[0]!
    const second = PITCH_STORY_HIGHLIGHTS[1]!

    expect(findHighlight(PITCH_STORY_HIGHLIGHTS, first.id)?.id).toBe(first.id)
    expect(nextSlideIndex(first, 0)).toBe(1)
    expect(nextSlideIndex(first, first.slides.length - 1)).toBeNull()
    expect(prevSlideIndex(0)).toBeNull()
    expect(prevSlideIndex(1)).toBe(0)
    expect(nextHighlightId(PITCH_STORY_HIGHLIGHTS, first.id)).toBe(second.id)
    expect(prevHighlightId(PITCH_STORY_HIGHLIGHTS, second.id)).toBe(first.id)
    expect(
      nextHighlightId(
        PITCH_STORY_HIGHLIGHTS,
        PITCH_STORY_HIGHLIGHTS[PITCH_STORY_HIGHLIGHTS.length - 1]!.id
      )
    ).toBeNull()
  })
})
