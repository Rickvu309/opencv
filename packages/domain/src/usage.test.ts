import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  dailyTurnCap,
  dayWindow,
  resolveModelRoute,
  sessionWindow,
  usageSnapshot,
  weekWindow,
} from "./account/usage.ts"

const zone = "Asia/Ho_Chi_Minh"

describe("usage windows", () => {
  it("starts the day at 07:00 and resets the next morning", () => {
    const morning = dayWindow(new Date("2026-10-26T00:30:00.000Z"), zone)
    assert.equal(morning.start.toISOString(), "2026-10-26T00:00:00.000Z")
    assert.equal(morning.resetsAt.toISOString(), "2026-10-27T00:00:00.000Z")

    const before = dayWindow(new Date("2026-10-25T23:30:00.000Z"), zone)
    assert.equal(before.start.toISOString(), "2026-10-25T00:00:00.000Z")
    assert.equal(before.resetsAt.toISOString(), "2026-10-26T00:00:00.000Z")
  })

  it("starts the week on Monday at 07:00", () => {
    const monday = weekWindow(new Date("2026-10-26T00:30:00.000Z"), zone)
    assert.equal(monday.start.toISOString(), "2026-10-26T00:00:00.000Z")
    assert.equal(monday.resetsAt.toISOString(), "2026-11-02T00:00:00.000Z")

    const earlyMonday = weekWindow(new Date("2026-10-25T23:00:00.000Z"), zone)
    assert.equal(earlyMonday.start.toISOString(), "2026-10-19T00:00:00.000Z")
    assert.equal(earlyMonday.resetsAt.toISOString(), "2026-10-26T00:00:00.000Z")
  })

  it("aligns a session to the block that contains now", () => {
    const afternoon = sessionWindow(
      new Date("2026-10-26T08:00:00.000Z"),
      zone,
      4
    )
    assert.equal(afternoon.start.toISOString(), "2026-10-26T08:00:00.000Z")
    assert.equal(afternoon.resetsAt.toISOString(), "2026-10-26T12:00:00.000Z")

    const beforeMorning = sessionWindow(
      new Date("2026-10-25T23:30:00.000Z"),
      zone,
      4
    )
    assert.equal(beforeMorning.start.toISOString(), "2026-10-25T20:00:00.000Z")
    assert.equal(
      beforeMorning.resetsAt.toISOString(),
      "2026-10-26T00:00:00.000Z"
    )

    const atSeven = sessionWindow(new Date("2026-10-26T00:00:00.000Z"), zone, 4)
    assert.equal(atSeven.start.toISOString(), "2026-10-26T00:00:00.000Z")
    assert.equal(atSeven.resetsAt.toISOString(), "2026-10-26T04:00:00.000Z")
  })

  it("keeps pro free mode uncapped and blocks light on a free plan", () => {
    assert.equal(dailyTurnCap("free", "free"), 20)
    assert.equal(dailyTurnCap("pro", "free"), 0)
    assert.equal(dailyTurnCap("pro", "light"), 10)
    assert.deepEqual(resolveModelRoute("free", "light"), {
      ok: false,
      code: "PLAN_REQUIRED",
    })
    assert.deepEqual(resolveModelRoute("pro", "max"), {
      ok: true,
      provider: "anthropic",
      modelId: "claude-opus-5-5",
    })
    assert.deepEqual(resolveModelRoute("free", "free"), {
      ok: true,
      provider: "anthropic",
      modelId: "claude-opus-5-5",
    })
  })

  it("omits numbers when the window is uncapped", () => {
    const snapshot = usageSnapshot({
      plan: "pro",
      mode: "free",
      timeZone: zone,
      now: new Date("2026-10-26T00:30:00.000Z"),
      sessionTurns: 3,
      dayTurns: 3,
      weekTurns: 9,
      cap: 0,
    })
    assert.equal(snapshot.day.capped, false)
    assert.equal("used" in snapshot.day, false)
    assert.equal("percent" in snapshot.session, false)
  })
})
