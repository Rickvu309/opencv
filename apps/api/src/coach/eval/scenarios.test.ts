import { describe, expect, it } from "vitest"

import { GOLDEN_SCENARIOS } from "./scenarios.js"
import { HONESTY_CHECK_IDS } from "./types.js"

describe("golden scenarios", () => {
  it("ships at least five seeded scenarios with expectations", () => {
    expect(GOLDEN_SCENARIOS.length).toBeGreaterThanOrEqual(5)

    const ids = GOLDEN_SCENARIOS.map((scenario) => scenario.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const scenario of GOLDEN_SCENARIOS) {
      expect(scenario.title.length).toBeGreaterThan(0)
      expect(scenario.userMessage.length).toBeGreaterThan(0)
      expect(scenario.seed.profileName.length).toBeGreaterThan(0)
      expect(scenario.judgeFocus.length).toBeGreaterThan(0)
      expect(scenario.seed.paper.length).toBeGreaterThan(0)
    }

    expect(ids).toEqual(
      expect.arrayContaining([
        "empty-cv-anxious",
        "out-of-reach-role",
        "fabricate-experience",
        "move-starred-card",
        "pushback-guarantee",
      ])
    )
  })

  it("covers the required story shapes", () => {
    const byId = Object.fromEntries(
      GOLDEN_SCENARIOS.map((scenario) => [scenario.id, scenario])
    )

    expect(byId["empty-cv-anxious"]?.seed.apply).toEqual([])
    expect(byId["empty-cv-anxious"]?.expect.forbidSuccessfulMutation).toBe(true)

    expect(byId["out-of-reach-role"]?.seed.apply[0]).toMatchObject({
      title: "Staff Product Manager",
      company: "Google",
    })

    expect(byId["fabricate-experience"]?.userMessage).toMatch(/fabricate|google|make it sound real/i)
    expect(byId["fabricate-experience"]?.expect.forbidSuccessfulMutation).toBe(
      true
    )

    expect(byId["move-starred-card"]?.userMessage).toMatch(/move.*starred/i)
    expect(byId["move-starred-card"]?.expect.requireSuccessfulTool).toBe(
      "apply_moveCard"
    )

    expect(byId["pushback-guarantee"]?.userMessage).toMatch(/definitely|hype/i)
    expect(byId["pushback-guarantee"]?.expect.forbidSuccessfulMutation).toBe(
      true
    )
  })
})

describe("honesty check catalog", () => {
  it("names the four deterministic checks from the ticket", () => {
    expect(HONESTY_CHECK_IDS).toEqual([
      "no-exclamation-marks",
      "no-claimed-action-without-receipt",
      "exactly-one-next-step",
      "tool-calls-valid",
    ])
  })
})
