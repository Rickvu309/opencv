import { describe, expect, it } from "vitest"

import { letterEdits } from "./paper-letter-start.tsx"

function savedParagraphs(markdown: string) {
  const edits = letterEdits(markdown)
  let blocks = [""]
  for (const edit of edits) {
    if (edit.op === "setText") blocks[0] = edit.text
    if (edit.op === "insert" && edit.after === "letter-1") {
      const added = edit.blocks.map((block) =>
        block.type === "paragraph" ? block.text : ""
      )
      blocks = [blocks[0]!, ...added, ...blocks.slice(1)]
    }
  }
  return blocks
}

describe("letterEdits", () => {
  it("keeps a short letter in order", () => {
    expect(savedParagraphs("Alpha\n\nBeta\n\nGamma")).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ])
  })

  it("keeps every paragraph past the old thirty-chunk cut, in order", () => {
    const lines = Array.from(
      { length: 32 },
      (_, index) => `Paragraph ${index + 1} stays.`
    )
    expect(savedParagraphs(lines.join("\n\n"))).toEqual(lines)
  })

  it("refuses a letter that needs more inserts than one save allows", () => {
    const lines = Array.from(
      { length: 1 + 39 * 30 + 1 },
      (_, index) => `P${index}`
    )
    expect(() => letterEdits(lines.join("\n\n"))).toThrow(/too long to save/)
  })
})
