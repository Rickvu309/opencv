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

export type ModelEnv = {
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
  env: ModelEnv
  factories?: ModelFactories
}): LanguageModel {
  const env = input.env
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

export type FreeComplete = (
  model: LanguageModel,
  prompt: string
) => Promise<string>

/** Last resort when a test does not inject `complete`. Verification uses the fake runtime, so this stays uncalled. */
export async function completeFree(
  model: LanguageModel,
  prompt: string
): Promise<string> {
  const { generateText } = await import("ai")
  const result = await generateText({ model, prompt })
  return result.text
}

export async function titleFromModel(input: {
  plan: Plan
  userText: string
  coachText: string
  env: ModelEnv
  factories?: ModelFactories
  complete?: FreeComplete
}): Promise<string> {
  const model = routeCoachModel({
    plan: input.plan,
    mode: "free",
    env: input.env,
    factories: input.factories,
  })
  const text = await (input.complete ?? completeFree)(
    model,
    `Write a short title for this chat. Reply with the title only.\nPerson: ${input.userText}\nCoach: ${input.coachText}`
  )
  return text.trim().replace(/\s+/g, " ").slice(0, 80)
}

export async function interpretPosting(input: {
  plan: Plan
  text: string
  env: ModelEnv
  factories?: ModelFactories
  complete?: FreeComplete
}): Promise<{ title: string; company: string; location: string } | null> {
  const model = routeCoachModel({
    plan: input.plan,
    mode: "free",
    env: input.env,
    factories: input.factories,
  })
  const raw = await (input.complete ?? completeFree)(
    model,
    `Extract company, title, and location as JSON with keys company, title, location.\n${input.text}`
  )
  return parsePostingJson(raw)
}

function parsePostingJson(
  raw: string
): { title: string; company: string; location: string } | null {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  let value: { title?: unknown; company?: unknown; location?: unknown }
  try {
    value = JSON.parse(raw.slice(start, end + 1)) as {
      title?: unknown
      company?: unknown
      location?: unknown
    }
  } catch {
    return null
  }
  const title = typeof value.title === "string" ? value.title.trim() : ""
  const company = typeof value.company === "string" ? value.company.trim() : ""
  const location =
    typeof value.location === "string" ? value.location.trim() : ""
  if (!company && !title) return null
  return { title, company, location }
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
