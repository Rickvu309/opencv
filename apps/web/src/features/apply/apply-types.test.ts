import { describe, expect, it } from "vitest"

import { DEFAULT_DEV_PROFILE_NAME } from "@/features/app-shell/dev-profile.ts"
import {
  formatTrackDate,
  SEED_CARDS,
  STAGES,
  trackKindLabel,
} from "@/features/apply/apply-types.ts"

describe("Apply helpers", () => {
  it("formats Track dates and kinds", () => {
    expect(formatTrackDate("2026-08-26")).toBe("Aug 26")
    expect(trackKindLabel("interview")).toBe("Interview")
    expect(trackKindLabel("deadline")).toBe("Deadline")
    expect(trackKindLabel("followup")).toBe("Follow-up")
    expect(trackKindLabel("applied")).toBe("Applied")
  })

  it("keeps Fit on the seed shape without a demo persona", () => {
    expect(STAGES.map((stage) => stage.id)).toEqual([
      "inbox",
      "prep",
      "sent",
      "live",
      "closed",
    ])
    expect(SEED_CARDS.length).toBeGreaterThan(0)
    expect(SEED_CARDS.every((card) => typeof card.fit === "number")).toBe(true)
    expect(JSON.stringify(SEED_CARDS)).not.toMatch(/Eric Nguyen/i)
    expect(DEFAULT_DEV_PROFILE_NAME).not.toMatch(/Eric/i)
  })
})
