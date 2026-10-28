import {
  decodePaperContent,
  emptyCvDocument,
  emptyLetterDocument,
  emptyProofDocument,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

describe("paper codecs", () => {
  it("accepts empty documents for each kind", () => {
    expect(decodePaperContent("cv", 1, emptyCvDocument())).toEqual({
      ok: true,
      data: emptyCvDocument(),
    })
    expect(decodePaperContent("letter", 1, emptyLetterDocument())).toEqual({
      ok: true,
      data: emptyLetterDocument(),
    })
    expect(decodePaperContent("proof", 1, emptyProofDocument())).toEqual({
      ok: true,
      data: emptyProofDocument(),
    })
  })

  it("rejects malformed content with a message the envelope can surface", () => {
    const letter = decodePaperContent("letter", 1, { markdown: 12 })
    expect(letter.ok).toBe(false)
    if (letter.ok) throw new Error("expected failure")
    expect(letter.message.length).toBeGreaterThan(0)

    const cv = decodePaperContent("cv", 1, { name: 5 })
    expect(cv).toEqual({
      ok: false,
      message:
        'Invalid option: expected one of "internship"|"product"|"service"|"academic"|"photo"',
    })

    const prefixed = decodePaperContent("cv", 1, "cv:v1:{}")
    expect(prefixed.ok).toBe(false)

    const version = decodePaperContent("letter", 2, { markdown: "" })
    expect(version).toEqual({
      ok: false,
      message: "Unsupported content version",
    })

    const blockVersion = decodePaperContent("cv", 1, { version: 3 })
    expect(blockVersion.ok).toBe(false)
    if (blockVersion.ok) throw new Error("expected failure")
    expect(blockVersion.message).toBe("Invalid content")

    const emptyHeader = decodePaperContent("cv", 1, { version: 2, header: {} })
    expect(emptyHeader).toEqual({ ok: false, message: "Invalid content" })
    expect(JSON.stringify(emptyHeader)).not.toContain("expected")
  })
})
