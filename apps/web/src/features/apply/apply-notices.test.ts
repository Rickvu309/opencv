import { describe, expect, it, vi } from "vitest"
import type { ApplyCard } from "@workspace/domain"

import { applyNotices } from "@/features/apply/apply-notices.ts"
import { sampleApplyCards } from "@/test/apply-fixtures.ts"

const handlers = { onClearDemo: vi.fn(), onOpenCard: vi.fn() }
const own = (patch: Partial<ApplyCard>): ApplyCard => ({
  ...(sampleApplyCards()[1] as ApplyCard),
  demo: false,
  ...patch,
})

describe("applyNotices", () => {
  it("shows the demo notice while starter cards remain", () => {
    const notices = applyNotices(
      sampleApplyCards() as ApplyCard[],
      "2026-09-01",
      new Set(),
      handlers
    )
    expect(notices.map((n) => n.id)).toEqual(["demo"])
    notices[0]!.action!.onClick!()
    expect(handlers.onClearDemo).toHaveBeenCalledOnce()
  })

  it("reminds about your own Follow-ups that are due, oldest first, at most two", () => {
    const cards = [
      own({
        id: "a",
        company: "Acme",
        trackKind: "followup",
        trackDate: "2026-08-30",
      }),
      own({
        id: "b",
        company: "Beta",
        trackKind: "followup",
        trackDate: "2026-08-28",
      }),
      own({
        id: "c",
        company: "Cora",
        trackKind: "followup",
        trackDate: "2026-08-29",
      }),
    ]
    const notices = applyNotices(cards, "2026-09-01", new Set(), handlers)
    expect(notices.map((n) => n.title)).toEqual([
      "Follow up with Beta",
      "Follow up with Cora",
    ])
    notices[0]!.action!.onClick!()
    expect(handlers.onOpenCard).toHaveBeenCalledWith("b")
  })

  it("skips Follow-ups in the future, in Closed, and on demo cards", () => {
    const cards = [
      own({ id: "a", trackKind: "followup", trackDate: "2026-09-02" }),
      own({
        id: "b",
        trackKind: "followup",
        trackDate: "2026-08-01",
        stage: "closed",
      }),
      own({
        id: "c",
        trackKind: "followup",
        trackDate: "2026-08-01",
        demo: true,
      }),
      own({ id: "d", trackKind: "interview", trackDate: "2026-08-01" }),
    ]
    expect(
      applyNotices(cards, "2026-09-01", new Set(), handlers).map((n) => n.id)
    ).toEqual(["demo"])
  })

  it("leaves out dismissed notices", () => {
    expect(
      applyNotices(
        sampleApplyCards() as ApplyCard[],
        "2026-09-01",
        new Set(["demo"]),
        handlers
      )
    ).toEqual([])
  })
})
