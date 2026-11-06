import {
  ERROR_CODES,
  PLAN_REQUIRED_MESSAGE,
  resolveModelRoute,
  type CoachMode,
  type Plan,
} from "@workspace/domain"
import {
  createAnthropicModel,
  completeAnthropic,
  type CoachModel,
} from "./anthropic-runtime.js"

import { CommandError } from "../registry/errors.js"

export type ModelEnv = { ANTHROPIC_API_KEY?: string }
export type ModelFactories = { anthropic: (modelId: string) => CoachModel }

export function routeCoachModel(input: {
  plan: Plan
  mode: CoachMode
  env: ModelEnv
  factories?: ModelFactories
}): CoachModel {
  const env = input.env
  const route = resolveModelRoute(input.plan, input.mode)
  if (!route.ok) {
    throw new CommandError(ERROR_CODES.PLAN_REQUIRED, PLAN_REQUIRED_MESSAGE)
  }
  const factories = input.factories ?? defaultFactories(env)
  if (!env.ANTHROPIC_API_KEY) {
    throw new CommandError(
      ERROR_CODES.COACH_UNAVAILABLE,
      "The Coach is unavailable right now"
    )
  }
  return factories.anthropic(route.modelId)
}

export type FreeComplete = (
  model: CoachModel,
  prompt: string
) => Promise<string>

export async function completeFree(
  model: CoachModel,
  prompt: string
): Promise<string> {
  return completeAnthropic(model, prompt)
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
    anthropic: () => createAnthropicModel({ apiKey: env.ANTHROPIC_API_KEY }),
  }
}
