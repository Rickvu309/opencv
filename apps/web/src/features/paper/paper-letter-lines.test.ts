import { describe, expect, it } from "vitest"

import { letterLines } from "./paper-letter-start.tsx"

describe("letterLines", () => {
  it("keeps a short letter in order, one Word line per paragraph", () => {
    expect(letterLines("Alpha\n\nBeta\n\n\nGamma")).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ])
  })

  it("joins a soft line break inside a paragraph and drops empty paragraphs", () => {
    expect(letterLines("Dear team,\nhello.\n\n   \n\nThanks")).toEqual([
      "Dear team, hello.",
      "Thanks",
    ])
  })

  it("keeps every paragraph past the old thirty-chunk cut, in order", () => {
    const lines = Array.from(
      { length: 32 },
      (_, index) => `Paragraph ${index + 1} stays.`
    )
    expect(letterLines(lines.join("\n\n"))).toEqual(lines)
  })

  it("splits a very long paragraph into lines a Word page accepts", () => {
    const long = "a".repeat(4500)
    const lines = letterLines(long)
    expect(lines.map((line) => line.length)).toEqual([2000, 2000, 500])
    expect(lines.join("")).toBe(long)
  })

  it("gives no line for an empty draft", () => {
    expect(letterLines("  \n\n ")).toEqual([])
  })
})
