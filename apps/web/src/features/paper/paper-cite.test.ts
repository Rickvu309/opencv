import { describe, expect, it } from "vitest"

import type { HomeMessage } from "@/features/home/threads.ts"

import {
  addSelectionChip,
  toggleContextChipPin,
} from "./coach-context-chips.ts"
import {
  citeForCoachMessage,
  citeFromCoachReply,
  extrasForCiteTurn,
  paperCiteHunksFromParts,
  paperCiteSpansFromCv,
  paperCiteSpansFromLetter,
  paperCiteSpansFromProof,
  previousUserText,
  rememberCoachCites,
} from "./paper-cite.ts"
import { DEFAULT_CV_DATA } from "./paper-cv-types.ts"
import { DEFAULT_CHECKOUT_PROOF } from "./paper-proof-types.ts"

const spans = paperCiteSpansFromCv(DEFAULT_CV_DATA)

describe("paperCiteSpansFromCv", () => {
  it("indexes Experience roles and bullets with Paper section ids", () => {
    expect(spans.some((span) => span.sectionId === "experience-1")).toBe(true)
    expect(
      spans.some((span) => span.sectionId === "experience-1-bullet-1")
    ).toBe(true)
    expect(
      spans.find((span) => span.sectionId === "experience-1")?.label
    ).toContain("Checkout UX")
  })
})

describe("citeFromCoachReply", () => {
  it("cites the matching Experience bullet when the reply names it", () => {
    const cite = citeFromCoachReply({
      ask: "What should I change about the checkout UX bullet?",
      reply:
        "The checkout UX hallway study is thin. Tighten the add-to-cart line so a recruiter can see the 18% lift.",
      spans,
    })
    expect(cite).toEqual({
      sectionId: "experience-1-bullet-1",
      label: expect.stringContaining("Checkout UX"),
    })
  })

  it("cites the Experience role when only the project name is mentioned", () => {
    const cite = citeFromCoachReply({
      ask: "Found the checkout UX section?",
      reply:
        "Found the checkout UX project. One next step is to name the company.",
      spans,
    })
    expect(cite?.sectionId).toBe("experience-1")
  })

  it("cites Summary when advice stays on that section", () => {
    const cite = citeFromCoachReply({
      ask: "Is my summary too long?",
      reply:
        "The summary already names Information Systems and associate product manager. Cut the slide-deck clause.",
      spans,
    })
    expect(cite?.sectionId).toBe("summary")
    expect(cite?.label).toBe("Summary")
  })

  it("uses a selection chip when the reply itself is generic", () => {
    const bullet = DEFAULT_CV_DATA.experience[0]?.bullets[0] ?? ""
    const chips = addSelectionChip(
      [],
      { text: bullet, sectionId: "experience-0-bullet-0" },
      "sel-1"
    )
    const cite = citeFromCoachReply({
      ask: "What is weak about this bullet?",
      reply: "I read that bullet.",
      spans,
      chips,
    })
    expect(cite?.sectionId).toBe("experience-0-bullet-0")
  })

  it("lets named prose beat a pinned selection chip on a different bullet", () => {
    const stale = DEFAULT_CV_DATA.experience[0]?.bullets[0] ?? ""
    const chips = toggleContextChipPin(
      addSelectionChip(
        [],
        { text: stale, sectionId: "experience-0-bullet-0" },
        "sel-1"
      ),
      "sel-1"
    )
    expect(chips[0]?.pinned).toBe(true)
    const cite = citeFromCoachReply({
      ask: "What should I change about the checkout UX bullet?",
      reply:
        "The checkout UX hallway study is thin. Tighten the add-to-cart line so a recruiter can see the 18% lift.",
      spans,
      chips,
    })
    expect(cite?.sectionId).toBe("experience-1-bullet-1")
    expect(cite?.sectionId).not.toBe("experience-0-bullet-0")
  })

  it("uses a live selection when chips are empty", () => {
    const bullet = DEFAULT_CV_DATA.experience[1]?.bullets[0] ?? ""
    const cite = citeFromCoachReply({
      ask: "Rewrite this later — first tell me what is missing.",
      reply: "The selected line needs a metric.",
      spans,
      selection: { text: bullet, sectionId: "experience-1-bullet-0" },
    })
    expect(cite?.sectionId).toBe("experience-1-bullet-0")
  })

  it("prefers a paper.updateContent hunk over prose matching", () => {
    const cite = citeFromCoachReply({
      ask: "Rewrite the summary",
      reply: "I shortened the summary and mentioned checkout in passing.",
      spans,
      hunks: [{ sectionId: "summary", section: "Summary" }],
    })
    expect(cite).toEqual({ sectionId: "summary", label: "Summary" })
  })

  it("returns null for generic advice with no CV span", () => {
    expect(
      citeFromCoachReply({
        ask: "What should I do this week?",
        reply:
          "Write one Proof with a concrete outcome. That is the next step.",
        spans,
      })
    ).toBeNull()
  })

  it("returns null when there are no spans", () => {
    expect(
      citeFromCoachReply({
        reply: "The checkout UX hallway study is thin.",
        spans: [],
      })
    ).toBeNull()
  })
})

describe("cite helpers", () => {
  it("reads the user ask before a Coach reply", () => {
    const messages: HomeMessage[] = [
      { id: "u1", role: "user", text: "Look at checkout UX" },
      { id: "c1", role: "coach", text: "The hallway study is thin." },
    ]
    expect(previousUserText(messages, "c1")).toBe("Look at checkout UX")
  })

  it("skips streaming Coach rows when resolving a cite", () => {
    const messages: HomeMessage[] = [
      { id: "u1", role: "user", text: "Look at checkout UX" },
      {
        id: "local-coach",
        role: "coach",
        text: "The checkout UX hallway study is thin.",
      },
    ]
    expect(citeForCoachMessage(messages[1]!, messages, spans)).toBeNull()
  })

  it("extracts receipt hunks from a must-edit part", () => {
    expect(
      paperCiteHunksFromParts([
        {
          type: "tool",
          name: "paper_replace",
          summary: "Updated content",
          ok: true,
          detail: {
            type: "paper.updateContent",
            docKind: "cv",
            docName: "PM track CV",
            hunks: [
              {
                section: "Summary",
                sectionId: "summary",
                lines: [{ kind: "add", text: "Short summary" }],
              },
            ],
          },
        },
      ])
    ).toEqual([{ sectionId: "summary", section: "Summary" }])
  })

  it("keeps a chip-grounded cite after a later Coach turn", () => {
    const bullet = DEFAULT_CV_DATA.experience[0]?.bullets[0] ?? ""
    const chips = toggleContextChipPin(
      addSelectionChip(
        [],
        { text: bullet, sectionId: "experience-0-bullet-0" },
        "sel-1"
      ),
      "sel-1"
    )
    const first: HomeMessage[] = [
      { id: "u1", role: "user", text: "What is weak about this bullet?" },
      { id: "c1", role: "coach", text: "I read that bullet." },
    ]
    const stored = rememberCoachCites({}, first, spans, {
      chips,
      selection: chips[0]?.selection,
    })
    expect(stored.c1?.sectionId).toBe("experience-0-bullet-0")

    const second: HomeMessage[] = [
      ...first,
      { id: "u2", role: "user", text: "And the next line?" },
      { id: "c2", role: "coach", text: "Say more?" },
    ]
    expect(extrasForCiteTurn("c1", "c2", { chips })).toBeUndefined()
    const after = rememberCoachCites(stored, second, spans, null)
    expect(after.c1?.sectionId).toBe("experience-0-bullet-0")
    expect(after.c2).toBeUndefined()
  })

  it("indexes letter and proof spans without a sources rail", () => {
    expect(paperCiteSpansFromLetter("Dear hiring manager,")[0]?.sectionId).toBe(
      "letter"
    )
    expect(
      paperCiteSpansFromProof(DEFAULT_CHECKOUT_PROOF).some(
        (span) => span.sectionId === "proof-title"
      )
    ).toBe(true)
  })
})
