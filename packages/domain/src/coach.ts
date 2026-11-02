import { z } from "zod"

import type { ChatToolName } from "./chat-turn.js"
import type { CommandEnvelope } from "./envelope.js"
import type {
  CoachReceiptDetail,
  CoachSelection,
  ReversalDescriptor,
} from "./chat-messages.js"
import type { ChatEntry, ChatEntryPart } from "./chat-messages.js"
import type { ReversalPlan } from "./registry.js"

export const coachModeSchema = z.enum(["free", "light", "max"])
export type CoachMode = z.infer<typeof coachModeSchema>
export const DEFAULT_COACH_MODE: CoachMode = "free"

const DEFAULT_COACH_MODEL_FREE = "openrouter/free"
const DEFAULT_COACH_MODEL_LIGHT = "deepseek/deepseek-chat-v3.1"
const DEFAULT_COACH_MODEL_MAX = "anthropic/claude-opus-4"

export const DEFAULT_COACH_MODELS = {
  free: DEFAULT_COACH_MODEL_FREE,
  light: DEFAULT_COACH_MODEL_LIGHT,
  max: DEFAULT_COACH_MODEL_MAX,
} as const satisfies Record<CoachMode, string>

const DEFAULT_COACH_DAILY_TURN_LIMIT_FREE = 50
const DEFAULT_COACH_DAILY_TURN_LIMIT_LIGHT = 30
const DEFAULT_COACH_DAILY_TURN_LIMIT_MAX = 10

const DEFAULT_COACH_DAILY_TURN_LIMITS = {
  free: DEFAULT_COACH_DAILY_TURN_LIMIT_FREE,
  light: DEFAULT_COACH_DAILY_TURN_LIMIT_LIGHT,
  max: DEFAULT_COACH_DAILY_TURN_LIMIT_MAX,
} as const satisfies Record<CoachMode, number>

type CoachModelEnv = {
  COACH_MODEL_FREE?: string
  COACH_MODEL_LIGHT?: string
  COACH_MODEL_MAX?: string
}

type CoachDailyTurnLimitEnv = {
  COACH_DAILY_TURN_LIMIT_FREE?: string
  COACH_DAILY_TURN_LIMIT_LIGHT?: string
  COACH_DAILY_TURN_LIMIT_MAX?: string
}

function trimmedEnv(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function positiveIntEnv(value: string | undefined) {
  const raw = trimmedEnv(value)
  if (!raw) return undefined
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) return undefined
  return parsed
}

/** Resolve the OpenRouter model id for a Coach mode. */
export function resolveCoachModel(
  mode: CoachMode,
  env: CoachModelEnv = {}
): string {
  const override = {
    free: env.COACH_MODEL_FREE,
    light: env.COACH_MODEL_LIGHT,
    max: env.COACH_MODEL_MAX,
  }[mode]

  return trimmedEnv(override) ?? DEFAULT_COACH_MODELS[mode]
}

/** Per-mode daily turn cap. Mode-specific env wins, then the mode default (50 / 30 / 10). */
export function resolveCoachDailyTurnLimit(
  mode: CoachMode,
  env: CoachDailyTurnLimitEnv = {}
): number {
  const override = {
    free: env.COACH_DAILY_TURN_LIMIT_FREE,
    light: env.COACH_DAILY_TURN_LIMIT_LIGHT,
    max: env.COACH_DAILY_TURN_LIMIT_MAX,
  }[mode]

  return positiveIntEnv(override) ?? DEFAULT_COACH_DAILY_TURN_LIMITS[mode]
}

export function coachProviderErrorMessage(
  error: unknown,
  mode: CoachMode = DEFAULT_COACH_MODE
): string {
  const text = error instanceof Error ? error.message : String(error ?? "")
  const status =
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : error &&
          typeof error === "object" &&
          "status" in error &&
          typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : undefined
  const isQuota =
    status === 402 ||
    status === 429 ||
    /\b402\b/.test(text) ||
    /\b429\b/.test(text) ||
    /payment required/i.test(text) ||
    /too many requests/i.test(text) ||
    /rate[- ]?limit/i.test(text)

  if (isQuota && mode === "free") {
    return "The free Coach is out of quota or rate-limited right now. Try Light mode, or try again later."
  }
  if (isQuota) {
    return "The Coach hit a provider limit. Try again in a moment, or switch modes."
  }

  const isUnroutable =
    status === 404 ||
    /no endpoints/i.test(text) ||
    /not a valid model/i.test(text)
  if (isUnroutable && mode === "free") {
    return "The free Coach model isn't available right now. Try Light mode."
  }
  if (isUnroutable) {
    return "The Coach model isn't available. Try another mode, or try again later."
  }

  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error.length > 0) return error
  return "The Coach could not finish"
}
export const COACH_SSE_HEARTBEAT_MS = 15_000

export type CoachTurnUsage = {
  model: string
  mode?: CoachMode
  tokens?: number
  costEstimate?: string
  latencyMs?: number
  finishReason?: string
}

type CoachTextDeltaPart = {
  type: "text-delta"
  text: string
}

type CoachToolCallPart = {
  type: "tool-call"
  toolCallId: string
  name: ChatToolName
  input: unknown
}

export type CoachToolResultPart = {
  type: "tool-result"
  toolCallId: string
  name: ChatToolName
  summary: string
  ok: boolean
  reversal?: ReversalDescriptor
  result: CommandEnvelope
  detail?: CoachReceiptDetail
  activityId?: string
  pendingActionId?: string
  command?: string
}

type CoachFinishPart = {
  type: "finish"
  finishReason: string
  usage: CoachTurnUsage
}

type CoachErrorPart = {
  type: "error"
  message: string
}

/** Incremental parts a runtime yields; the route translates these to SSE. */
export type CoachStreamPart =
  | CoachTextDeltaPart
  | CoachToolCallPart
  | CoachToolResultPart
  | CoachFinishPart
  | CoachErrorPart

export type CoachFocusDoc = {
  id: string
  name: string
  kind: "cv" | "letter" | "proof"
  status: "draft" | "ready" | "published"
  outline: string
  revision: number
}

type CoachExecuted = {
  pending: boolean
  pendingActionId?: string | undefined
  summary?: string | undefined
  command?: string | undefined
  output?: unknown
  activityId: string | null
  reversal: ReversalPlan
}

export type CoachTurnInput = {
  userId: string
  chatId: string
  history: ChatEntry[]
  model?: string
  mode?: CoachMode
  /** Fresh turn answering the latest User message; prior coach row stays in history. */
  regenerate?: boolean
  /** Open Paper document when the User is sending from the editor AI panel. */
  focusDoc?: CoachFocusDoc
  /** Highlighted Paper text when the User sends from the editor. */
  selection?: CoachSelection
  /** Names and titles for this turn. Bytes never appear here. */
  note?: string
  execute?: (call: { name: string; input: unknown }) => Promise<CoachExecuted>
}

export type CoachTitleInput = {
  userText: string
  coachText: string
}

export type ApplyScanExtractInput = {
  postingText: string
}

/** Injected via `AppConfig.coach` like `db`. */
export type CoachRuntime = {
  streamTurn(input: CoachTurnInput): AsyncIterable<CoachStreamPart>
  /**
   * Optional Light-tier title for the first turn. Missing or throwing
   * implementations fall back to the deterministic summarizer.
   */
  generateTitle?(input: CoachTitleInput): Promise<string>
  /**
   * Optional Free-tier JSON extract of title/company/note from posting
   * text (QVE-218). Missing implementations fail scan honestly unless
   * the posting already carries structured JobPosting markup.
   */
  scanJobPosting?(input: ApplyScanExtractInput): Promise<string>
}

/**
 * Fold a runtime part into the persisted message parts. Consecutive text
 * deltas merge; tool-calls are stream-only until their result arrives.
 */
export function appendCoachPart(
  parts: readonly ChatEntryPart[],
  part: CoachStreamPart
): ChatEntryPart[] {
  switch (part.type) {
    case "text-delta": {
      const last = parts[parts.length - 1]
      if (last?.type === "text") {
        return [
          ...parts.slice(0, -1),
          { type: "text", text: last.text + part.text },
        ]
      }
      return [...parts, { type: "text", text: part.text }]
    }
    case "tool-result": {
      return [
        ...parts,
        {
          type: "tool",
          name: part.name,
          summary: part.summary,
          ok: part.ok,
          ...(part.reversal ? { reversal: part.reversal } : {}),
          ...(part.detail ? { detail: part.detail } : {}),
          ...(part.activityId ? { activityId: part.activityId } : {}),
          ...(part.pendingActionId
            ? {
                pendingActionId: part.pendingActionId,
                approval: "pending" as const,
              }
            : {}),
          toolCallId: part.toolCallId,
        },
      ]
    }
    default:
      return [...parts]
  }
}
