import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  appendCoachPart,
  COACH_MODEL,
  resolveCoachModel,
  resolveCoachDailyTurnLimit,
  type CoachStreamPart,
} from "./coach/coach.ts"

describe("resolveCoachModel", () => {
  it("uses the owner model in every mode", () => {
    for (const mode of ["free", "light", "max"] as const) {
      assert.equal(resolveCoachModel(mode), "claude-opus-5-5")
      assert.equal(resolveCoachModel(mode), COACH_MODEL)
    }
  })
})

const DEFAULT_LIMITS = { free: 50, light: 30, max: 10 }

describe("resolveCoachDailyTurnLimit", () => {
  it("uses each mode default when no env is set", () => {
    for (const [mode, limit] of Object.entries(DEFAULT_LIMITS)) {
      assert.equal(
        resolveCoachDailyTurnLimit(mode as "free" | "light" | "max"),
        limit
      )
    }
  })

  it("lets the mode-specific env win and ignores one that is not a positive integer", () => {
    assert.equal(
      resolveCoachDailyTurnLimit("light", {
        COACH_DAILY_TURN_LIMIT_LIGHT: "7",
      }),
      7
    )
    for (const bad of ["0", "-3", "1.5", "abc", " "]) {
      assert.equal(
        resolveCoachDailyTurnLimit("light", {
          COACH_DAILY_TURN_LIMIT_LIGHT: bad,
        }),
        30
      )
    }
    assert.equal(
      resolveCoachDailyTurnLimit("max", { COACH_DAILY_TURN_LIMIT_LIGHT: "7" }),
      10
    )
  })
})

describe("appendCoachPart", () => {
  it("merges consecutive text deltas into one text part", () => {
    const parts = [
      { type: "text-delta", text: "He" },
      { type: "text-delta", text: "llo" },
    ] as CoachStreamPart[]
    const folded = parts.reduce(
      appendCoachPart,
      [] as ReturnType<typeof appendCoachPart>
    )
    assert.deepEqual(folded, [{ type: "text", text: "Hello" }])
  })

  it("keeps a tool call out of the saved parts until its result arrives", () => {
    const call = {
      type: "tool-call",
      toolCallId: "t1",
      name: "job.create",
      input: {},
    } as CoachStreamPart
    assert.deepEqual(appendCoachPart([], call), [])
    const result = {
      type: "tool-result",
      toolCallId: "t1",
      name: "job.create",
      summary: "Added",
      ok: true,
    } as CoachStreamPart
    assert.equal(appendCoachPart([], result).length, 1)
  })
})
