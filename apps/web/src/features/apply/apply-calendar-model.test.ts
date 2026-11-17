import { describe, expect, it } from "vitest"

import { mockJob } from "@/test/apply-job-fixtures.ts"

import { calendarEvents, rangeFor, weekDays } from "./apply-calendar-model.ts"
import { PROFILE_ZONE } from "./apply-stages.ts"

describe("rangeFor", () => {
  it("starts the week at local midnight so a 06:30 Monday interview is inside", () => {
    const { from, to } = rangeFor(weekDays("2026-10-26"), PROFILE_ZONE)
    expect(from).toBe("2026-10-25T17:00:00.000Z")
    expect(to).toBe("2026-11-01T17:00:00.000Z")
    const interview = "2026-10-25T23:30:00.000Z"
    expect(interview >= from && interview < to).toBe(true)
  })

  it("bins the same interview on the day it has in the chosen zone", () => {
    const job = mockJob({ interviewAt: "2026-10-26T03:00:00.000Z" })
    const profile = calendarEvents([job], PROFILE_ZONE).find(
      (event) => event.kind === "interview"
    )
    const york = calendarEvents([job], "America/New_York").find(
      (event) => event.kind === "interview"
    )
    expect(profile?.day).toBe("2026-10-26")
    expect(york?.day).toBe("2026-10-25")
    expect(rangeFor(["2026-10-26"], "America/New_York").from).toBe(
      "2026-10-26T04:00:00.000Z"
    )
  })
})
