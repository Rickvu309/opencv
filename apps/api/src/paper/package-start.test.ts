import {
  PAPER_START_BOUNDS,
  PAPER_TEMPLATE_IDS,
  paperContract,
  paperStartInputSchema,
  type PaperStartInput,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { startedLines, startedName } from "./package-start.js"

const PLACEHOLDERS = /^\[[^\]\n]+\](?: \| \[[^\]\n]+\])*$/

describe("a page the Coach starts", () => {
  it.each(PAPER_TEMPLATE_IDS)(
    "starts the %s CV inside the bounds, every line a placeholder or a heading",
    (templateId) => {
      const lines = startedLines({ kind: "cv", templateId })
      expect(lines.length).toBeGreaterThan(0)
      expect(lines.length).toBeLessThanOrEqual(PAPER_START_BOUNDS.lines)
      for (const line of lines) {
        expect(line.text.length).toBeLessThanOrEqual(
          PAPER_START_BOUNDS.lineLength
        )
        if (line.style !== "Heading1") expect(line.text).toMatch(PLACEHOLDERS)
      }
    }
  )

  it("starts a letter with no lines", () => {
    expect(startedLines({ kind: "letter" })).toEqual([])
  })

  it("names the page from its template, a Job or the person's name", () => {
    const cv: PaperStartInput = { kind: "cv" }
    const letter: PaperStartInput = { kind: "letter" }
    expect(startedName(cv, null)).toBe("Simple CV.docx")
    expect(startedName({ kind: "cv", templateId: "modern" }, null)).toBe(
      "Modern CV.docx"
    )
    expect(startedName(letter, "Lumiere")).toBe("Cover letter, Lumiere.docx")
    expect(startedName(letter, " ")).toBe("Cover letter.docx")
    expect(startedName(letter, "L".repeat(400))).toBe("Cover letter.docx")
    expect(startedName({ kind: "letter", name: "For Lumiere" }, "X")).toBe(
      "For Lumiere.docx"
    )
  })
})

const jobId = "11111111-1111-4111-8111-111111111111"

describe("paper.start takes no words of the Coach's", () => {
  it("accepts a kind, a template for a CV, a name and a Job", () => {
    for (const input of [
      { kind: "cv" },
      { kind: "letter", name: "Cover letter, Lumiere", jobId },
      { kind: "cv", templateId: "modern" },
    ])
      expect(paperStartInputSchema.safeParse(input).success).toBe(true)
  })

  it("refuses free text, a block document and a template on a letter", () => {
    for (const input of [
      { kind: "cv", lines: ["Led a team of ten"] },
      { kind: "cv", text: "Led a team of ten" },
      { kind: "cv", document: { kind: "cv" } },
      { kind: "cv", content: "Led a team of ten" },
      { kind: "letter", templateId: "simple" },
      { kind: "cv", name: "x".repeat(500) },
    ])
      expect(paperStartInputSchema.safeParse(input).success).toBe(false)
  })

  it("waits for the person, and the older block create is closed to the Coach", () => {
    expect(paperContract["paper.start"].coach).toBe("confirm")
    expect(paperContract["paper.start"].delegate).toBeUndefined()
    expect(paperContract["paper.create"].coach).toBe("never")
    expect(paperContract["paper.canvas"].coach).toBe("never")
  })
})
