import { z } from "zod"

import type { CommandEnvelope } from "./envelope.js"
import type { ReversalDescriptor } from "./commands.js"
import type { CoachReceiptDetail, CoachSelection } from "./threads.js"
import type { ThreadMessage, ThreadMessagePart } from "./threads.js"

export const coachModeSchema = z.enum(["free", "light", "max"])
export type CoachMode = z.infer<typeof coachModeSchema>
export const COACH_MODES = coachModeSchema.options
export const DEFAULT_COACH_MODE: CoachMode = "free"

export const DEFAULT_COACH_MODEL_FREE = "openrouter/free"
export const DEFAULT_COACH_MODEL_LIGHT = "deepseek/deepseek-chat-v3.1"
export const DEFAULT_COACH_MODEL_MAX = "anthropic/claude-opus-4"

export const DEFAULT_COACH_MODELS = {
  free: DEFAULT_COACH_MODEL_FREE,
  light: DEFAULT_COACH_MODEL_LIGHT,
  max: DEFAULT_COACH_MODEL_MAX,
} as const satisfies Record<CoachMode, string>

export const DEFAULT_COACH_DAILY_TURN_LIMIT_FREE = 50
export const DEFAULT_COACH_DAILY_TURN_LIMIT_LIGHT = 30
export const DEFAULT_COACH_DAILY_TURN_LIMIT_MAX = 10

export const DEFAULT_COACH_DAILY_TURN_LIMITS = {
  free: DEFAULT_COACH_DAILY_TURN_LIMIT_FREE,
  light: DEFAULT_COACH_DAILY_TURN_LIMIT_LIGHT,
  max: DEFAULT_COACH_DAILY_TURN_LIMIT_MAX,
} as const satisfies Record<CoachMode, number>

export type CoachModelEnv = {
  COACH_MODEL_FREE?: string
  COACH_MODEL_LIGHT?: string
  COACH_MODEL_MAX?: string
}

export type CoachDailyTurnLimitEnv = {
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
export const COACH_STEP_CAP = 8
export const DEFAULT_COACH_MAX_OUTPUT_TOKENS = 4096
export const COACH_HISTORY_MESSAGE_CAP = 40
export const COACH_HISTORY_CHAR_BUDGET = 16_000
export const COACH_WORKSPACE_LIST_CAP = 8

export const COACH_SSE_EVENTS = {
  messageStart: "message-start",
  textDelta: "text-delta",
  step: "step",
  toolCall: "tool-call",
  toolResult: "tool-result",
  confirm: "confirm",
  usage: "usage",
  messageEnd: "message-end",
  error: "error",
} as const

export type CoachSseEvent =
  (typeof COACH_SSE_EVENTS)[keyof typeof COACH_SSE_EVENTS]

export const coachUsageRatingSchemaValues = ["up", "down"] as const
export const coachUsageRatingSchema = z.enum(coachUsageRatingSchemaValues)
export type CoachUsageRating = z.infer<typeof coachUsageRatingSchema>

export const coachFeedbackInputSchema = z
  .object({
    rating: coachUsageRatingSchema,
  })
  .strict()

export type CoachFeedbackInput = z.infer<typeof coachFeedbackInputSchema>

export type CoachTurnUsage = {
  model: string
  mode?: CoachMode
  tokens?: number
  costEstimate?: string
  latencyMs?: number
  finishReason?: string
}

export type CoachUsageRecord = CoachTurnUsage & {
  id: string
  userId: string
  threadId: string | null
  messageId: string | null
  rating: CoachUsageRating | null
  createdAt: string
}

export type CoachTextDeltaPart = {
  type: "text-delta"
  text: string
}

export type CoachToolCallPart = {
  type: "tool-call"
  toolCallId: string
  name: string
  input: unknown
}

export type CoachToolResultPart = {
  type: "tool-result"
  toolCallId: string
  name: string
  summary: string
  ok: boolean
  reversal?: ReversalDescriptor
  result: CommandEnvelope
  detail?: CoachReceiptDetail
  pendingActionId?: string
  command?: string
  activityId?: string
}

export type CoachFinishPart = {
  type: "finish"
  finishReason: string
  usage: CoachTurnUsage
}

export type CoachErrorPart = {
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

export type CoachSseMessageStartData = {
  threadId: string
}

export type CoachSseTextDeltaData = {
  text: string
}

export type CoachSseToolCallData = {
  toolCallId: string
  name: string
  input: unknown
}

export type CoachSseToolResultData = {
  toolCallId: string
  name: string
  summary: string
  ok: boolean
  reversal?: ReversalDescriptor
  result: CommandEnvelope
  detail?: CoachReceiptDetail
}

export type CoachSseMessageEndData = {
  message: ThreadMessage
  usage: CoachTurnUsage
}

export type CoachSseErrorData = {
  message: string
}

export type CoachFocusDoc = {
  id: string
  name: string
  kind: "cv" | "letter" | "proof"
  status: "draft" | "ready" | "published"
  /** Current body so an edit ask can call paper_updateContent without a prior get. */
  content: unknown
  contentVersion: number
}

export type CoachTurnInput = {
  userId: string
  threadId: string
  history: ThreadMessage[]
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
}

export type CoachTitleInput = {
  userText: string
  coachText: string
}

export type ApplyScanExtractInput = {
  postingText: string
}

/** Injected via `AppConfig.coach` like `db` (ADR-0007). */
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
  parts: readonly ThreadMessagePart[],
  part: CoachStreamPart
): ThreadMessagePart[] {
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
          toolCallId: part.toolCallId,
        },
      ]
    }
    default:
      return [...parts]
  }
}
