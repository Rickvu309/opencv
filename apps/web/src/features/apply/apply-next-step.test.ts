import { describe, expect, it } from "vitest"

import { nextSteps } from "@/features/apply/apply-next-step.ts"

describe("nextSteps", () => {
  it("recommends Prep first from Inbox and offers a Follow-up instead", () => {
    const [first, second] = nextSteps({ stage: "inbox", company: "Acme" })
    expect(first).toMatchObject({ label: "Move to Prep", stage: "prep" })
    expect(first!.reason).toContain("Acme")
    expect(second).toMatchObject({ trackKind: "followup" })
  })

  it("walks a card forward one Stage at a time", () => {
    expect(nextSteps({ stage: "prep", company: "A" })[0]).toMatchObject({
      stage: "sent",
    })
    expect(nextSteps({ stage: "sent", company: "A" })[0]).toMatchObject({
      trackKind: "followup",
    })
    expect(nextSteps({ stage: "live", company: "A" })[0]).toMatchObject({
      trackKind: "interview",
    })
  })

  it("suggests nothing for a closed card", () => {
    expect(nextSteps({ stage: "closed", company: "A" })).toEqual([])
  })
})
