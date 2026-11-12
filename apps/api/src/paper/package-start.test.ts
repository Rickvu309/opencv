import {
  PAPER_START_BOUNDS,
  PAPER_TEMPLATE_IDS,
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
