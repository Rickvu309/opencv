import {
  DEFAULT_COACH_MODEL,
  resolveCoachModel,
  type CoachRuntime,
} from "@workspace/domain"

import type { AppDatabase } from "../commands/registry.js"
import { createDemoCoachRuntime } from "./fake.js"
import { createOpenRouterCoachRuntime } from "./runtime.js"

export type CoachRuntimeConfig = {
  db?: AppDatabase
  openRouterApiKey?: string
  coachModel?: string
  /** Light-tier id for first-turn titles. Defaults to `resolveCoachModel("light")`. */
  titleModel?: string
  runtimeMode?: "fake"
}

/**
 * Wire the injected runtime: scripted fake for local protocol checks,
 * OpenRouter when a key is present, otherwise leave the coach route 503.
 */
export function coachRuntimeFromConfig({
  db,
  openRouterApiKey,
  coachModel,
  titleModel,
  runtimeMode,
}: CoachRuntimeConfig): CoachRuntime | undefined {
  if (runtimeMode === "fake") {
    return createDemoCoachRuntime()
  }
  if (!openRouterApiKey || !db) {
    return undefined
  }
  return createOpenRouterCoachRuntime({
    apiKey: openRouterApiKey,
    model: coachModel ?? DEFAULT_COACH_MODEL,
    titleModel: titleModel ?? resolveCoachModel("light"),
    db,
  })
}
