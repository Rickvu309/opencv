import {
  alignStoryChipIdentity,
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

  it("rewrites a persisted story chip so its label matches the opened highlight", () => {
    const starter = starterPitchDocument()
    const checkout = starter.storyHighlights.find((h) => h.id === "sh-checkout")
    expect(checkout?.label).toBe("Checkout")

    const persisted = {
      ...starter,
      bento: starter.bento.map((card) =>
        card.id === "b4"
          ? {
              ...card,
              title: "my sacred space",
              body: "Hallway test · late night Figma",
              storyHighlightId: "sh-checkout",
            }
          : card
      ),
    }

    const decoded = decodePitchContent("pitch", 1, persisted)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    const story = decoded.data.bento.find((card) => card.id === "b4")
    expect(story).toMatchObject({
      title: "Checkout",
      body: "Hallway test setup",
      storyHighlightId: "sh-checkout",
    })
    expect(JSON.stringify(decoded.data)).not.toMatch(/sacred space/i)
    expect(alignStoryChipIdentity(decoded.data)).toBe(decoded.data)
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
