import { describe, expect, it } from "vitest"

import { wordChangeHeading, wordChangeRows } from "@/lib/writing-proposal.ts"

describe("word change rows", () => {
  it("treats words on an empty line as one added line", () => {
    const change = {
      op: "setText" as const,
      before: "",
      after: "Helped customers resolve requests.",
    }
    expect(wordChangeRows(change)).toEqual([
      { label: "New line", text: "Helped customers resolve requests." },
    ])
    expect(wordChangeHeading(change)).toBe("Add a line")
  })

  it("keeps before and after when the line already has words", () => {
    const change = {
      op: "setText" as const,
      before: "Supported customers.",
      after: "Resolved requests.",
    }
    expect(wordChangeRows(change)).toEqual([
      { label: "Before", text: "Supported customers." },
      { label: "After", text: "Resolved requests." },
    ])
    expect(wordChangeHeading(change)).toBe("Change a line")
  })

  it("names an insert from the rows without a second empty-before check", () => {
    const change = {
      op: "insert" as const,
      before: "",
      after: "A new line",
      place: null,
    }
    expect(wordChangeRows(change).map((row) => row.label)).toEqual([
      "Where",
      "New line",
    ])
    expect(wordChangeHeading(change)).toBe("Add a line")
  })
})
