import {
  COACH_MODES,
  DEFAULT_COACH_MODE,
  coachModeSchema,
  type CoachMode,
} from "@workspace/domain"

import { openRouterApiKeyFromEnv } from "../../config.js"

import { scenarioById } from "./scenarios.js"
import type { GoldenScenario } from "./types.js"

export function requireOpenRouterApiKey(env: NodeJS.ProcessEnv): string {
  const key = openRouterApiKeyFromEnv(env)
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is required to run the Coach eval harness"
    )
  }
  return key
}

/**
 * Modes the harness should score. Uses ADR-0009 `resolveCoachModel` — no
 * second routing layer. Unset defaults to `free`. `all` runs Free, Light,
 * and Max in that order.
 */
export function coachEvalModesFromEnv(env: NodeJS.ProcessEnv): CoachMode[] {
  const raw = env.COACH_EVAL_MODE?.trim()
  if (!raw) return [DEFAULT_COACH_MODE]
  if (raw === "all") return [...COACH_MODES]
  const parsed = coachModeSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `Unknown COACH_EVAL_MODE "${raw}". Use free, light, max, or all.`
    )
  }
  return [parsed.data]
}

export function scenariosToRun(
  all: GoldenScenario[],
  filter: string | undefined
): GoldenScenario[] {
  if (!filter) return all
  const selected = scenarioById(filter)
  if (!selected) {
    throw new Error(
      `Unknown scenario "${filter}". Known: ${all.map((s) => s.id).join(", ")}`
    )
  }
  return [selected]
}
