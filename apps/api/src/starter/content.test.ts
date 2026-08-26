import {
  PAPER_CONTENT_VERSION,
  STARTER_CV_NAME,
  STARTER_THREAD_COACH_TEXT,
  STARTER_THREAD_TITLE,
  decodePaperContent,
  isoDateFromOffset,
  starterApplyCards,
  starterCvContent,
  starterCvDocument,
  starterThread,
} from "@workspace/domain"
import { describe, expect, it } from "vitest"

const PERSONA = /Eric Nguyen|\bEric\b|Alex Tran/i

function flattenStarterCopy() {
  return [
    STARTER_CV_NAME,
    STARTER_THREAD_TITLE,
    STARTER_THREAD_COACH_TEXT,
    JSON.stringify(starterCvDocument()),
    JSON.stringify(starterApplyCards()),
    starterThread().coachText,
  ].join("\n")
}

describe("starter content", () => {
  it("is a valid CV codec payload and never a named persona", () => {
    const decoded = decodePaperContent(
      "cv",
      PAPER_CONTENT_VERSION,
      starterCvContent()
    )
    expect(decoded.ok).toBe(true)
    expect(starterCvDocument().name).toBe("Your name")
    expect(STARTER_CV_NAME).toBe("Sample internship CV")
    expect(flattenStarterCopy()).not.toMatch(PERSONA)
    expect(flattenStarterCopy()).not.toMatch(/cv:v1:|proof:v1:/)
    expect(flattenStarterCopy()).not.toMatch(/!/)
  })

  it("spreads Apply cards across Stages without fit or a persona", () => {
    const cards = starterApplyCards()
    expect(cards.map((card) => card.stage)).toEqual([
      "inbox",
      "prep",
      "sent",
      "closed",
    ])
    expect(cards.some((card) => card.starred)).toBe(true)
    expect(JSON.stringify(cards)).not.toMatch(/"fit"/)
    expect(JSON.stringify(cards)).not.toMatch(PERSONA)
  })

  it("opens with an honest Coach Thread in the product voice", () => {
    const thread = starterThread()
    expect(thread.title).toBe(STARTER_THREAD_TITLE)
    expect(thread.coachText).toContain("I haven't edited Paper or Apply")
    expect(thread.coachText).toContain("haven't run any Commands")
    expect(thread.coachText).toContain("seeded for you")
    expect(thread.coachText).not.toMatch(/stub Coach/)
    expect(thread.coachText).not.toMatch(/!/)
    expect(thread.coachText).not.toMatch(PERSONA)
  })

  it("computes Track dates from a fixed clock", () => {
    const now = new Date("2026-08-25T15:30:00.000Z")
    expect(isoDateFromOffset(now, 1)).toBe("2026-08-26")
    expect(isoDateFromOffset(now, -15)).toBe("2026-08-10")
  })
})
