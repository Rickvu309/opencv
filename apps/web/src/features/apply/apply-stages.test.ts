import { describe, expect, it } from "vitest"

import type { Job } from "./apply-api.ts"
import { companyInitials, listPhrase, priorityLabel } from "./apply-stages.ts"

const now = new Date("2026-10-27T03:00:00.000Z")

function job(patch: Partial<Job>): Job {
  return {
    id: "01900000-0000-7000-8000-000000000010",
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
    expect(listPhrase(job({ stage: "saved" }), now)).toBe("Saved today")
    expect(
      listPhrase(job({ stage: "saved", deadline: "2026-11-08" }), now)
    ).toBe("Apply by Nov 8")
    expect(
      listPhrase(
        job({ stage: "applied", updatedAt: "2026-10-14T04:00:00.000Z" }),
        now
      )
    ).toBe("Applied Oct 14")
    expect(
      listPhrase(
        job({
          stage: "interview",
          interviewAt: "2026-11-03T03:00:00.000Z",
        }),
        now
      )
    ).toBe("Interview Tue, 10:00")
    expect(listPhrase(job({ stage: "offer" }), now)).toBe("Offer")
    expect(listPhrase(job({ stage: "closed" }), now)).toBe("Closed")
    expect(priorityLabel("normal")).toBe("Normal")
    expect(priorityLabel("low")).toBe("Low")
    expect(priorityLabel("high")).toBe("High")
    expect(companyInitials("Lumière Cosmetics")).toBe("LC")
    expect(companyInitials("Northwind")).toBe("NO")
  })
})
