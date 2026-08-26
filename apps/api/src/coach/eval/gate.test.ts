import { describe, expect, it } from "vitest"

import {
  coachEvalModesFromEnv,
  requireOpenRouterApiKey,
  scenariosToRun,
} from "./gate.js"
import { GOLDEN_SCENARIOS } from "./scenarios.js"

describe("requireOpenRouterApiKey", () => {
  it("refuses when the key is missing", () => {
    expect(() => requireOpenRouterApiKey({})).toThrow(
      /OPENROUTER_API_KEY is required to run the Coach eval harness/
    )
    expect(() => requireOpenRouterApiKey({ OPENROUTER_API_KEY: "   " })).toThrow(
      /OPENROUTER_API_KEY is required/
    )
  })

  it("returns a trimmed key", () => {
    expect(
      requireOpenRouterApiKey({ OPENROUTER_API_KEY: "  sk-or-eval  " })
    ).toBe("sk-or-eval")
  })
})

describe("coachEvalModesFromEnv", () => {
  it("defaults to free and accepts a single mode, all, or rejects junk", () => {
    expect(coachEvalModesFromEnv({})).toEqual(["free"])
    expect(coachEvalModesFromEnv({ COACH_EVAL_MODE: "  light  " })).toEqual([
      "light",
    ])
    expect(coachEvalModesFromEnv({ COACH_EVAL_MODE: "max" })).toEqual(["max"])
    expect(coachEvalModesFromEnv({ COACH_EVAL_MODE: "all" })).toEqual([
      "free",
      "light",
      "max",
    ])
    expect(() => coachEvalModesFromEnv({ COACH_EVAL_MODE: "ultra" })).toThrow(
      /Unknown COACH_EVAL_MODE/
    )
  })
})

describe("scenariosToRun", () => {
  it("returns all scenarios unless a known id is set", () => {
    expect(scenariosToRun(GOLDEN_SCENARIOS, undefined)).toHaveLength(
      GOLDEN_SCENARIOS.length
    )
    expect(scenariosToRun(GOLDEN_SCENARIOS, "move-starred-card")).toEqual([
      expect.objectContaining({ id: "move-starred-card" }),
    ])
    expect(() => scenariosToRun(GOLDEN_SCENARIOS, "nope")).toThrow(/Unknown scenario/)
  })
})
