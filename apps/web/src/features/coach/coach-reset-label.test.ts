import { describe, expect, it } from "vitest"

import { coachResetLabel } from "./coach-reset-label.ts"

const now = new Date(2026, 10, 16, 21, 30)

describe("coachResetLabel", () => {
  it("names today, tomorrow or the date of the reset", () => {
    expect(
      coachResetLabel(new Date(2026, 10, 16, 23, 0).toISOString(), now)
    ).toMatch(/^today at 23:00$/)
    expect(
      coachResetLabel(new Date(2026, 10, 17, 0, 0).toISOString(), now)
    ).toMatch(/^tomorrow at 00:00$/)
    expect(
      coachResetLabel(new Date(2026, 10, 19, 7, 0).toISOString(), now)
    ).toMatch(/ at 07:00$/)
    expect(
      coachResetLabel(new Date(2026, 10, 19, 7, 0).toISOString(), now)
    ).not.toMatch(/^(today|tomorrow)/)
  })

  it("says later for an unreadable time", () => {
    expect(coachResetLabel("not a date", now)).toBe("later")
  })
})
