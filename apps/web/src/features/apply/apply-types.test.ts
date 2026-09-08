import { describe, expect, it } from "vitest"

import {
  companyShort,
  formatTrackDate,
  localIsoDate,
  STAGES,
  trackKindLabel,
} from "@/features/apply/apply-types.ts"
import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"

describe("Apply helpers", () => {
  it("formats local calendar dates from the browser clock", () => {
    expect(localIsoDate(new Date(2026, 7, 26, 12))).toBe("2026-08-26")
  })

  it("formats Track dates and kinds", () => {
    expect(formatTrackDate("2026-08-26")).toBe("Aug 26")
    expect(trackKindLabel("interview")).toBe("Interview")
    expect(trackKindLabel("deadline")).toBe("Deadline")
    expect(trackKindLabel("followup")).toBe("Follow-up")
    expect(trackKindLabel("applied")).toBe("Applied")
  })

  it("fits five fluid Stages on a 1280 laptop; fixed 16rem columns do not", () => {
    const viewport = 1280
    const sidebar = 15 * 16
    const stages = STAGES.length
    const available = viewport - sidebar
    const fixedNeeded = stages * 16 * 16 + 32 + 12 * (stages - 1)
    const fluidChrome = 24 + 8 * (stages - 1)
    expect(stages).toBe(5)
    expect(fixedNeeded).toBeGreaterThan(available)
    expect(fluidChrome).toBeLessThan(available)
  })

  it("derives company initials without a demo persona or Fit", () => {
    expect(STAGES.map((stage) => stage.id)).toEqual([
      "inbox",
      "prep",
      "sent",
      "live",
      "closed",
    ])
    expect(companyShort("Local startup")).toBe("LS")
    expect(companyShort("Agency")).toBe("AG")
    const cards = sampleApplyCards()
    expect(cards.length).toBeGreaterThan(0)
    expect(JSON.stringify(cards)).not.toMatch(/"fit"/)
    expect(JSON.stringify(cards)).not.toMatch(/Eric Nguyen/i)
    expect(SAMPLE_AUTHOR_NAME).not.toMatch(/Eric/i)
  })
})
