import { describe, expect, it } from "vitest"

import { rangeFor, weekDays } from "./apply-calendar-model.ts"

describe("rangeFor", () => {
  it("starts the week at local midnight so a 06:30 Monday interview is inside", () => {
    const { from, to } = rangeFor(weekDays("2026-10-26"))
    expect(from).toBe("2026-10-25T17:00:00.000Z")
    expect(to).toBe("2026-11-01T17:00:00.000Z")
    const interview = "2026-10-25T23:30:00.000Z"
    expect(interview >= from && interview < to).toBe(true)
  })
})
