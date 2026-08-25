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
