import {
  withoutBlankParts,
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

  it("decodes an old body-only letter byte for byte", () => {
    const stored = { markdown: "Dear team,\n\nHello.\r\n\n\n" }
    const decoded = decodePaperContent("letter", 1, stored)
    expect(decoded).toEqual({ ok: true, data: stored })
    expect(JSON.stringify(decoded.ok && decoded.data)).toBe(
      JSON.stringify(stored)
    )
  })

  it("decodes a letter with every part", () => {
    const full = {
      markdown: "First.\n\nSecond.",
      sender: "Linh Nguyen",
      contact: "linh@example.com | 090 123 4567",
      date: "October 26, 2026",
      recipient: "Hiring Team\nAcme\nHo Chi Minh City",
      salutation: "Dear Hiring Team,",
      closing: "Sincerely,",
      signature: "Linh Nguyen",
    }
    expect(decodePaperContent("letter", 1, full)).toEqual({
      ok: true,
      data: full,
    })
  })

  it("refuses an unknown letter key and a non-string part", () => {
    expect(
      decodePaperContent("letter", 1, { markdown: "", footer: "x" }).ok
    ).toBe(false)
    expect(decodePaperContent("letter", 1, { markdown: "", date: 3 }).ok).toBe(
      false
    )
  })

  it("keeps the cv and proof unions unaffected by letter parts", () => {
    expect(
      decodePaperContent("cv", 1, { ...emptyCvDocument(), sender: "Linh" }).ok
    ).toBe(false)
    expect(
      decodePaperContent("proof", 1, { ...emptyProofDocument(), date: "x" }).ok
    ).toBe(false)
  })

  it("drops empty and blank letter parts when a writer compacts", () => {
    expect(
      withoutBlankParts({
        markdown: "Body ",
        sender: "",
        contact: "   ",
        date: undefined,
        recipient: "A\nB",
        signature: "Linh",
      })
    ).toEqual({ markdown: "Body ", recipient: "A\nB", signature: "Linh" })
    expect(withoutBlankParts({ markdown: "x", date: "" })).toStrictEqual({
      markdown: "x",
    })
  })
})
