import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  ERROR_CODES,
  PLAN_REQUIRED_MESSAGE,
  resolveModelRoute,
  type CoachMode,
  type Plan,
} from "@workspace/domain"
import type { LanguageModel } from "ai"

import { CommandError } from "../registry/errors.js"

type ModelEnv = {
  ANTHROPIC_API_KEY?: string
  OPENROUTER_API_KEY?: string
  COACH_MODEL_FREE?: string
  COACH_MODEL_PRO_FREE?: string
  COACH_MODEL_LIGHT?: string
  COACH_MODEL_MAX?: string
}

export type ModelFactories = {
  openrouter: (modelId: string) => LanguageModel
  anthropic: (modelId: string) => LanguageModel
}

export function routeCoachModel(input: {
  plan: Plan
  mode: CoachMode
  env?: ModelEnv
  factories?: ModelFactories
}): LanguageModel {
  const env = input.env ?? process.env
  const route = resolveModelRoute(input.plan, input.mode, env)
  if (!route.ok) {
    throw new CommandError(ERROR_CODES.PLAN_REQUIRED, PLAN_REQUIRED_MESSAGE)
  }
  const factories = input.factories ?? defaultFactories(env)
  if (route.provider === "openrouter") {
    return factories.openrouter(route.modelId)
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new CommandError(
      ERROR_CODES.COACH_UNAVAILABLE,
      "The Coach is unavailable right now"
    )
  }
  return factories.anthropic(route.modelId)
}

function defaultFactories(env: ModelEnv): ModelFactories {
  return {
    openrouter(modelId) {
      const apiKey = env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new CommandError(
          ERROR_CODES.COACH_UNAVAILABLE,
          "The Coach is unavailable right now"
        )
      }
      return createOpenRouter({ apiKey })(modelId)
    },
    anthropic(modelId) {
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY ?? "" })(modelId)
    },
  }
}
