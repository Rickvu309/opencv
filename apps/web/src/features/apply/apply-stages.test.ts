import { parseJobId } from "@workspace/domain/kernel"
import { describe, expect, it } from "vitest"

import type { JobView } from "@workspace/domain/apply"
import {
  PROFILE_ZONE,
  companyInitials,
  interviewInputValue,
  interviewInstant,
  listPhrase,
  priorityLabel,
} from "./apply-stages.ts"

const now = new Date("2026-10-27T03:00:00.000Z")

function job(patch: Partial<JobView>): JobView {
  return {
    id: parseJobId("01900000-0000-7000-8000-000000000010"),
    title: "Junior Marketing",
    company: "Lumière Cosmetics",
    stage: "saved",
    position: "a0",
    location: "Hanoi",
    priority: "normal",
    jobUrl: null,
    sourceHost: null,
    description: "",
    posting: null,
    interviewAt: null,
    deadline: null,
    recruiterName: null,
    recruiterEmail: null,
    cvDocId: null,
    letterDocId: null,
    starred: false,
    createdAt: "2026-10-27T02:00:00.000Z",
    updatedAt: "2026-10-27T02:00:00.000Z",
    ...patch,
  }
}

describe("apply stages", () => {
  it("derives list phrases and the normal priority label", () => {
    expect(listPhrase(job({ stage: "saved" }), now, PROFILE_ZONE)).toBe(
      "Saved today"
    )
    expect(
      listPhrase(
        job({ stage: "saved", deadline: "2026-11-08" }),
        now,
        PROFILE_ZONE
      )
    ).toBe("Apply by Nov 8")
    expect(
      listPhrase(
        job({ stage: "applied", updatedAt: "2026-10-14T04:00:00.000Z" }),
        now,
        PROFILE_ZONE
      )
    ).toBe("Applied Oct 14")
    expect(
      listPhrase(
        job({
          stage: "interview",
          interviewAt: "2026-11-03T03:00:00.000Z",
        }),
        now,
        PROFILE_ZONE
      )
    ).toBe("Interview Tue, 10:00")
    expect(listPhrase(job({ stage: "offer" }), now, PROFILE_ZONE)).toBe("Offer")
    expect(listPhrase(job({ stage: "closed" }), now, PROFILE_ZONE)).toBe(
      "Closed"
    )
    expect(priorityLabel("normal")).toBe("Normal")
    expect(priorityLabel("low")).toBe("Low priority")
    expect(priorityLabel("high")).toBe("High priority")
    expect(companyInitials("Lumière Cosmetics")).toBe("LC")
    expect(companyInitials("Northwind")).toBe("NO")
  })

  it("keeps the interview hour in the profile zone", () => {
    const iso = "2026-10-27T03:00:00.000Z"
    expect(interviewInputValue(iso, PROFILE_ZONE)).toBe("2026-10-27T10:00")
    expect(interviewInstant("2026-10-27T10:00", PROFILE_ZONE)).toBe(iso)
  })

  it("keeps the interview hour in a chosen zone", () => {
    const iso = "2026-10-27T03:00:00.000Z"
    expect(interviewInputValue(iso, "Asia/Singapore")).toBe("2026-10-27T11:00")
    expect(interviewInstant("2026-10-27T11:00", "Asia/Singapore")).toBe(iso)
    expect(
      listPhrase(
        job({ stage: "interview", interviewAt: iso }),
        now,
        "Asia/Singapore"
      )
    ).toBe("Interview Tue, 11:00")
  })
})
