import { describe, expect, it } from "vitest"
import type { DiffHunk } from "@workspace/domain"

import { addSuggestion, suggestionSentence } from "./paper-suggestion.ts"

const hunk = (section: string): DiffHunk => ({
  section,
  sectionId: section.toLowerCase(),
  lines: [{ kind: "add", text: "x" }],
})

describe("paper suggestion", () => {
  it("starts from the first hunks and keeps the earliest previous content", () => {
    const first = addSuggestion(null, { v: 1 }, [hunk("Summary")])
    expect(first).toEqual({
      previous: { v: 1 },
      sections: ["Summary"],
      sectionIds: ["summary"],
    })
    const second = addSuggestion(first, { v: 2 }, [
      hunk("Experience"),
      hunk("Summary"),
    ])
    expect(second).toEqual({
      previous: { v: 1 },
      sections: ["Summary", "Experience"],
      sectionIds: ["summary", "experience"],
    })
  })

  it("keeps the current suggestion when nothing changed", () => {
    expect(addSuggestion(null, {}, [])).toBeNull()
    const current = {
      previous: 1,
      sections: ["Summary"],
      sectionIds: ["summary"],
    }
    expect(addSuggestion(current, 2, [])).toBe(current)
  })

  it("names the changed sections in one sentence", () => {
    expect(suggestionSentence(["Summary"])).toBe(
      "Coach changed Summary. Keep it or undo this change."
    )
    expect(suggestionSentence(["Summary", "Skills"])).toBe(
      "Coach changed Summary and Skills. Keep it or undo this change."
    )
    expect(suggestionSentence(["A", "B", "C"])).toBe(
      "Coach changed A, B and C. Keep it or undo this change."
    )
  })
})
