import {
  alignStoryChipIdentity,
  decodePitchContent,
  emptyPitchDocument,
  hasLeftoverStarterMoments,
  healPitchDocument,
  isDemoPitchDocument,
  isStarterSampleIdentity,
  LEGACY_FAKE_PITCH_HEADLINE,
  preservePitchMoments,
  STARTER_PITCH_ABOUT_LEAD,
  STARTER_PITCH_HEADLINE,
  STARTER_CHECKOUT_ACHIEVEMENT_TITLE,
  STARTER_CHECKOUT_PITCH_HEADLINE,
  STARTER_CHECKOUT_PROOF_ID,
  starterCheckoutAchievement,
  legacyStarterPitchDocument,
  starterPitchDocument,
  withStarterCheckoutAchievement,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

function leftoverPersonaPitch() {
  const starter = legacyStarterPitchDocument()
  return {
    ...starter,
    github: { username: "alex-tran-uit", connected: true },
    bento: starter.bento.map((card) => {
      if (card.id === "b1") return { ...card, title: "Alex Tran" }
      if (card.id === "b4") {
        return {
          ...card,
          title: "my sacred space",
          body: "Hallway test · late night Figma",
          storyHighlightId: "sh-checkout",
        }
      }
      if (card.id === "b5") return { ...card, title: "@alex-tran-uit" }
      return card
    }),
  }
}

describe("pitch codecs", () => {
  it("accepts an empty document and the starter payload", () => {
    expect(decodePitchContent("pitch", 1, emptyPitchDocument())).toEqual({
      ok: true,
      data: emptyPitchDocument(),
    })
    expect(
      decodePitchContent("pitch", 1, legacyStarterPitchDocument())
    ).toEqual({
      ok: true,
      data: legacyStarterPitchDocument(),
    })
    expect(decodePitchContent("pitch", 1, starterPitchDocument())).toEqual({
      ok: true,
      data: starterPitchDocument(),
    })
    expect(starterPitchDocument().achievements[0]).toEqual(
      starterCheckoutAchievement()
    )
    expect(legacyStarterPitchDocument().achievements[0]?.proofId).toBe(
      STARTER_CHECKOUT_PROOF_ID
    )
    expect(legacyStarterPitchDocument().achievements[0]?.link).toBeUndefined()
    expect(legacyStarterPitchDocument().demo).toBe(true)
    expect(legacyStarterPitchDocument().about).toContain(
      STARTER_PITCH_ABOUT_LEAD
    )
    expect(isDemoPitchDocument(legacyStarterPitchDocument())).toBe(true)
    expect(isDemoPitchDocument(emptyPitchDocument())).toBe(false)
    expect(isStarterSampleIdentity(legacyStarterPitchDocument())).toBe(true)
    expect(isStarterSampleIdentity(emptyPitchDocument())).toBe(false)
    expect(emptyPitchDocument().demo).toBe(false)
  })

  it("treats unlabeled sample About as Demo content so Clear demo can show", () => {
    const starter = legacyStarterPitchDocument()
    const { demo: _demo, ...rest } = starter
    expect(_demo).toBe(true)
    expect(isDemoPitchDocument(rest)).toBe(true)

    const decoded = decodePitchContent("pitch", 1, rest)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.demo).toBe(true)
    expect(isDemoPitchDocument(decoded.data)).toBe(true)
    expect(decoded.data.about).toContain(STARTER_PITCH_ABOUT_LEAD)
  })

  it("does not stamp Demo content on a User-owned Pitch without sample About", () => {
    const owned = {
      ...emptyPitchDocument(),
      headline: "Design intern · night shift",
      about: "I ship small checkout studies.",
    }
    expect(isDemoPitchDocument(owned)).toBe(false)

    const decoded = decodePitchContent("pitch", 1, owned)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.demo).not.toBe(true)
    expect(isDemoPitchDocument(decoded.data)).toBe(false)
    expect(decoded.data.headline).toBe("Design intern · night shift")
    expect(decoded.data.about).toBe("I ship small checkout studies.")
    expect(decoded.data.storyHighlights).toEqual([])
    expect(decoded.data.bento).toEqual([])
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
    const starter = legacyStarterPitchDocument()
    const checkout = starter.storyHighlights.find((h) => h.id === "sh-checkout")
    expect(checkout?.label).toBe("Checkout")

    const persisted = {
      ...starter,
      github: { username: "alex-tran-uit", connected: true },
      bento: starter.bento
        .map((card) => {
          if (card.id === "b1") {
            return { ...card, title: "Alex Tran" }
          }
          if (card.id === "b4") {
            return {
              ...card,
              title: "my sacred space",
              body: "Hallway test · late night Figma",
              storyHighlightId: "sh-checkout",
            }
          }
          return card
        })
        .concat({
          id: "b5",
          kind: "link",
          title: "@alex-tran-uit",
          body: "GitHub · mock",
          tone: "dark",
          span: "wide",
        }),
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
    expect(decoded.data.bento.find((card) => card.id === "b1")?.title).toBe(
      "Your name"
    )
    expect(decoded.data.bento.find((card) => card.id === "b5")?.title).toBe(
      "@github"
    )
    expect(decoded.data.github.username).toBe("")
    expect(JSON.stringify(decoded.data)).not.toMatch(/sacred space/i)
    expect(JSON.stringify(decoded.data)).not.toMatch(/Alex Tran/i)
    expect(alignStoryChipIdentity(decoded.data)).toBe(decoded.data)
  })

  it("repairs a leftover sacred-space Moments card even without a highlight id", () => {
    const starter = legacyStarterPitchDocument()
    const persisted = {
      ...starter,
      bento: starter.bento.map((card) =>
        card.id === "b4"
          ? {
              ...card,
              title: "my sacred space",
              body: "Hallway test · late night Figma",
              storyHighlightId: undefined,
            }
          : card
      ),
    }

    const decoded = decodePitchContent("pitch", 1, persisted)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.bento.find((card) => card.id === "b4")).toMatchObject({
      title: "Checkout",
      body: "Hallway test setup",
      storyHighlightId: "sh-checkout",
    })
  })

  it("adds one checkout Proof card on an empty Pitch without stamping demo", () => {
    const empty = emptyPitchDocument()
    const next = withStarterCheckoutAchievement(empty)
    expect(next.achievements).toEqual([starterCheckoutAchievement()])
    expect(next.demo).toBe(false)
    expect(next.headline).toBe(STARTER_CHECKOUT_PITCH_HEADLINE)
    expect(isDemoPitchDocument(next)).toBe(false)
    expect(withStarterCheckoutAchievement(next)).toEqual(next)
    expect(next.achievements[0]?.title).toBe(STARTER_CHECKOUT_ACHIEVEMENT_TITLE)
    expect(next.achievements[0]?.proofId).toBe(STARTER_CHECKOUT_PROOF_ID)
    expect(JSON.stringify(next.achievements)).not.toMatch(/"#"/)

    const decoded = decodePitchContent("pitch", 1, next)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.achievements).toEqual([starterCheckoutAchievement()])
    expect(decoded.data.headline).toBe(STARTER_CHECKOUT_PITCH_HEADLINE)
    expect(decoded.data.storyHighlights).toEqual([])
    expect(decoded.data.bento).toEqual([])
    expect(isDemoPitchDocument(decoded.data)).toBe(false)

    const identityCleared =
      next.demo !== true &&
      next.headline.trim() === "" &&
      next.status.trim() === "" &&
      next.about.trim() === ""
    expect(identityCleared).toBe(false)
  })

  it("keeps a unique id when a1 is already taken by another card", () => {
    const next = withStarterCheckoutAchievement({
      ...emptyPitchDocument(),
      achievements: [
        {
          id: "a1",
          year: "2024",
          title: "Campus expense app",
          context: "UIT Product Club",
          description: "Led discovery for a student expense splitter.",
        },
      ],
    })
    expect(next.achievements).toHaveLength(2)
    expect(next.achievements[1]).toEqual(
      starterCheckoutAchievement("a-checkout")
    )
    expect(next.headline).toBe(STARTER_CHECKOUT_PITCH_HEADLINE)
  })

  it("still accepts a persisted achievement that only has a dead link", () => {
    const starter = legacyStarterPitchDocument()
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

  it("does not write empty Moments arrays when heal repairs leftover personas", () => {
    const leftover = leftoverPersonaPitch()
    const decoded = decodePitchContent("pitch", 1, leftover)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")

    expect(decoded.data.storyHighlights.length).toBe(
      leftover.storyHighlights.length
    )
    expect(decoded.data.bento.length).toBe(leftover.bento.length)
    expect(decoded.data.storyHighlights.length).toBeGreaterThan(0)
    expect(decoded.data.bento.length).toBeGreaterThan(0)
    expect(decoded.data.bento.find((card) => card.id === "b4")).toMatchObject({
      title: "Checkout",
      body: "Hallway test setup",
      storyHighlightId: "sh-checkout",
    })
    expect(JSON.stringify(decoded.data)).not.toMatch(/sacred space/i)
    expect(JSON.stringify(decoded.data)).not.toMatch(/Alex Tran/i)

    const persisted = preservePitchMoments(leftover, decoded.data)
    expect(persisted.storyHighlights).toEqual(decoded.data.storyHighlights)
    expect(persisted.bento).toEqual(decoded.data.bento)
    expect(
      preservePitchMoments(leftover, {
        ...decoded.data,
        storyHighlights: [],
        bento: [],
      })
    ).toMatchObject({
      storyHighlights: leftover.storyHighlights,
      bento: leftover.bento,
    })
  })

  it("restores starter Moments after a wipe so GET/heal is smokeable", () => {
    const starter = legacyStarterPitchDocument()
    const wiped = {
      ...starter,
      status: "QVE134-persist-marker-1532",
      storyHighlights: [],
      bento: [],
      blocks: starter.blocks.map((block) =>
        block.kind === "moments" ? { ...block, hidden: true } : block
      ),
    }

    const decoded = decodePitchContent("pitch", 1, wiped)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.storyHighlights.length).toBeGreaterThan(0)
    expect(decoded.data.bento.length).toBeGreaterThan(0)
    expect(decoded.data.storyHighlights).toEqual(starter.storyHighlights)
    expect(decoded.data.bento.find((card) => card.id === "b4")).toMatchObject({
      title: "Checkout",
      body: "Hallway test setup",
      storyHighlightId: "sh-checkout",
    })
    expect(
      decoded.data.blocks.find((block) => block.kind === "moments")
    ).toEqual({ id: "b-moments", kind: "moments", hidden: true })
    expect(JSON.stringify(decoded.data)).not.toMatch(/sacred space/i)
    expect(JSON.stringify(decoded.data)).not.toMatch(/Alex Tran/i)
    expect(healPitchDocument(decoded.data)).toEqual(decoded.data)
  })

  it("relabels a leftover UIT/PM headline as Demo content", () => {
    const starter = legacyStarterPitchDocument()
    const { demo, ...rest } = starter
    expect(demo).toBe(true)
    const legacy = {
      ...rest,
      headline: LEGACY_FAKE_PITCH_HEADLINE,
    }

    const decoded = decodePitchContent("pitch", 1, legacy)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.demo).toBe(true)
    expect(decoded.data.headline).toBe(STARTER_PITCH_HEADLINE)
    expect(isDemoPitchDocument(decoded.data)).toBe(true)
    expect(JSON.stringify(decoded.data)).not.toMatch(
      /Aspiring product manager/i
    )
  })

  it("allows a full clear so Demo content can become an empty Pitch", () => {
    expect(
      preservePitchMoments(legacyStarterPitchDocument(), emptyPitchDocument())
    ).toEqual(emptyPitchDocument())
  })

  it("does not restore sample Moments after Clear demo leaves identity copy empty", () => {
    const starter = legacyStarterPitchDocument()
    const leftover = {
      ...starter,
      demo: undefined,
      headline: "",
      status: "",
      about: "",
    }
    expect(isDemoPitchDocument(leftover)).toBe(false)
    expect(hasLeftoverStarterMoments(leftover)).toBe(true)

    const decoded = decodePitchContent("pitch", 1, leftover)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.storyHighlights).toEqual([])
    expect(decoded.data.bento).toEqual([])
    expect(decoded.data.achievements).toEqual([])
    expect(JSON.stringify(decoded.data)).not.toMatch(/campus club/i)
    expect(JSON.stringify(decoded.data)).not.toMatch(/\+18%/)
    expect(isDemoPitchDocument(decoded.data)).toBe(false)
  })

  it("does not put sample Moments back when a cleared Pitch gets a real About", () => {
    const starter = legacyStarterPitchDocument()
    const typed = {
      ...emptyPitchDocument(),
      about: "I ship small checkout studies.",
    }
    expect(preservePitchMoments(starter, typed)).toEqual(typed)

    const decoded = decodePitchContent("pitch", 1, typed)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.storyHighlights).toEqual([])
    expect(decoded.data.bento).toEqual([])
    expect(decoded.data.about).toBe("I ship small checkout studies.")
    expect(JSON.stringify(decoded.data)).not.toMatch(/campus club/i)
    expect(JSON.stringify(decoded.data)).not.toMatch(/\+18%/)
  })

  it("does not restore chips when demo:true leaked onto a real About", () => {
    const starter = legacyStarterPitchDocument()
    const leaked = {
      ...emptyPitchDocument(),
      demo: true,
      about: "I ship small checkout studies.",
    }
    expect(isDemoPitchDocument(leaked)).toBe(true)
    expect(isStarterSampleIdentity(leaked)).toBe(false)
    expect(preservePitchMoments(starter, leaked)).toEqual(leaked)

    const decoded = decodePitchContent("pitch", 1, leaked)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.about).toBe("I ship small checkout studies.")
    expect(decoded.data.storyHighlights).toEqual([])
    expect(decoded.data.bento).toEqual([])
    expect(
      decoded.data.blocks.find((block) => block.kind === "moments")?.hidden
    ).toBe(true)
    expect(JSON.stringify(decoded.data)).not.toMatch(/Checkout/)
    expect(JSON.stringify(decoded.data)).not.toMatch(/Wallet audit/)
    expect(JSON.stringify(decoded.data)).not.toMatch(/Club sprint/)
    expect(JSON.stringify(decoded.data)).not.toMatch(/campus club/i)
    expect(JSON.stringify(decoded.data)).not.toMatch(/\+18%/)
  })

  it("does not restore chips after Clear plus a real status line", () => {
    const starter = legacyStarterPitchDocument()
    const typed = {
      ...emptyPitchDocument(),
      demo: true,
      status: "Open to intern roles · Summer 2026",
    }
    expect(preservePitchMoments(starter, typed)).toEqual(typed)

    const decoded = decodePitchContent("pitch", 1, typed)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.status).toBe("Open to intern roles · Summer 2026")
    expect(decoded.data.storyHighlights).toEqual([])
    expect(decoded.data.bento).toEqual([])
  })

  it("keeps the empty schema default empty and still accepts extra leftover keys", () => {
    expect(decodePitchContent("pitch", 1, emptyPitchDocument())).toEqual({
      ok: true,
      data: emptyPitchDocument(),
    })

    const leftover = {
      ...leftoverPersonaPitch(),
      legacySeed: true,
    }
    const decoded = decodePitchContent("pitch", 1, leftover)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) throw new Error("expected success")
    expect(decoded.data.storyHighlights.length).toBeGreaterThan(0)
    expect(decoded.data.bento.length).toBeGreaterThan(0)
    expect(JSON.stringify(decoded.data)).not.toMatch(/sacred space/i)
    expect(JSON.stringify(decoded.data)).not.toMatch(/Alex Tran/i)
    expect(decoded.data).not.toHaveProperty("legacySeed")
  })
})
