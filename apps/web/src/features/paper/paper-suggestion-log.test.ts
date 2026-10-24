import { describe, expect, it } from "vitest"

import {
  logSuggestion,
  suggestionNotes,
  type PaperSuggestion,
} from "./paper-suggestion.ts"

const open: PaperSuggestion = {
  previous: {},
  sections: ["Summary"],
  sectionIds: ["summary"],
}

describe("suggestion log", () => {
  it("appends one entry per decision with a stable id", () => {
    const first = logSuggestion([], open, "kept", 10)
    const second = logSuggestion(first, open, "undone", 20)
    expect(second.map((entry) => entry.id)).toEqual([
      "suggestion-0",
      "suggestion-1",
    ])
    expect(second.map((entry) => entry.outcome)).toEqual(["kept", "undone"])
  })

  it("lists decided changes first and the open one last", () => {
    const log = logSuggestion([], open, "kept", 10)
    const notes = suggestionNotes(log, { ...open, sections: ["Skills"] }, 30)
    expect(notes.map((note) => note.status)).toEqual([
      "You kept it",
      "Waiting for your decision",
    ])
    expect(notes[1]).toMatchObject({
      id: "suggestion-open",
      details: ["Skills"],
      at: 30,
    })
  })

  it("lists nothing when there is no change", () => {
    expect(suggestionNotes([], null, 0)).toEqual([])
  })
})
