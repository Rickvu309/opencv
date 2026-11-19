import { describe, expect, it } from "vitest"

import { mockJob } from "@/test/apply-job-fixtures.ts"

import { nextUp } from "./apply-next-up.ts"

const NOW = new Date("2026-11-19T03:00:00.000Z")
const ZONE = "Asia/Ho_Chi_Minh"

function id(n: number) {
  return `01900000-0000-7000-8000-0000000000${String(n).padStart(2, "0")}` as ReturnType<
    typeof mockJob
  >["id"]
}

describe("next up", () => {
  it("lists upcoming interviews and deadlines by date, then offers, then quiet applications", () => {
    const items = nextUp(
      [
        mockJob({
          id: id(1),
          company: "Quiet",
          stage: "applied",
          updatedAt: "2026-11-09T03:00:00.000Z",
        }),
        mockJob({ id: id(2), company: "Offer", stage: "offer" }),
        mockJob({
          id: id(3),
          company: "Later interview",
          stage: "interview",
          interviewAt: "2026-11-24T03:00:00.000Z",
        }),
        mockJob({
          id: id(4),
          company: "Deadline",
          stage: "saved",
          deadline: "2026-11-21",
        }),
      ],
      NOW,
      ZONE
    )
    expect(items.map((item) => [item.company, item.label])).toEqual([
      ["Deadline", "Apply by Nov 21"],
      ["Later interview", "Interview Tue Nov 24, 10:00"],
      ["Offer", "Answer the offer"],
      ["Quiet", "Follow up, applied 10 days ago"],
    ])
  })

  it("leaves out past interviews, past deadlines, recent applications and closed jobs", () => {
    const items = nextUp(
      [
        mockJob({
          id: id(1),
          stage: "interview",
          interviewAt: "2026-11-18T03:00:00.000Z",
        }),
        mockJob({ id: id(2), stage: "saved", deadline: "2026-11-18" }),
        mockJob({
          id: id(3),
          stage: "applied",
          updatedAt: "2026-11-15T03:00:00.000Z",
        }),
        mockJob({ id: id(4), stage: "closed" }),
        mockJob({ id: id(5), stage: "saved" }),
      ],
      NOW,
      ZONE
    )
    expect(items).toEqual([])
  })

  it("keeps a deadline that falls today in the person's zone", () => {
    const items = nextUp(
      [mockJob({ id: id(1), stage: "saved", deadline: "2026-11-19" })],
      NOW,
      ZONE
    )
    expect(items.map((item) => item.label)).toEqual(["Apply by Nov 19"])
  })

  it("shows at most four items", () => {
    const offers = [1, 2, 3, 4, 5].map((n) =>
      mockJob({ id: id(n), stage: "offer" })
    )
    expect(nextUp(offers, NOW, ZONE)).toHaveLength(4)
  })
})
