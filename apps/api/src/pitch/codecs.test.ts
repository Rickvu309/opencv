import {
  decodePitchContent,
  emptyPitchDocument,
  starterPitchDocument,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

describe("pitch codecs", () => {
  it("accepts an empty document and the starter payload", () => {
    expect(decodePitchContent("pitch", 1, emptyPitchDocument())).toEqual({
      ok: true,
      data: emptyPitchDocument(),
    })
    expect(decodePitchContent("pitch", 1, starterPitchDocument())).toEqual({
      ok: true,
      data: starterPitchDocument(),
    })
    expect(starterPitchDocument().achievements[0]?.proofId).toBe("checkout")
    expect(starterPitchDocument().achievements[0]?.link).toBeUndefined()
  })

  it("rejects malformed content with a message the envelope can surface", () => {
    const missing = decodePitchContent("pitch", 1, { headline: "nope" })
    expect(missing.ok).toBe(false)
    if (missing.ok) throw new Error("expected failure")
    expect(missing.message.length).toBeGreaterThan(0)

    const kind = decodePitchContent("cv", 1, emptyPitchDocument())
    expect(kind).toEqual({
      ok: false,
      message: "Unsupported content kind",
    })

    const version = decodePitchContent("pitch", 2, emptyPitchDocument())
    expect(version).toEqual({
      ok: false,
      message: "Unsupported content version",
    })
  })

  it("still accepts a persisted achievement that only has a dead link", () => {
    const starter = starterPitchDocument()
    const decoded = decodePitchContent("pitch", 1, {
      ...starter,
      achievements: [
        {
          ...starter.achievements[0],
          proofId: undefined,
          link: "#",
          linkLabel: "Read case study",
        },
      ],
    })
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.achievements[0]?.link).toBe("#")
    expect(decoded.data.achievements[0]?.proofId).toBeUndefined()
  })
})
