import type { CommandEnvelope } from "./envelope.js"
import type { ReversalDescriptor } from "./commands.js"
import type { ThreadMessage } from "./threads.js"

export const DEFAULT_COACH_MODEL = "anthropic/claude-sonnet-4.5"
export const DEFAULT_COACH_DAILY_TURN_LIMIT = 50

export const COACH_SSE_EVENTS = {
  messageStart: "message-start",
  textDelta: "text-delta",
  toolCall: "tool-call",
  toolResult: "tool-result",
  messageEnd: "message-end",
  error: "error",
} as const

export type CoachSseEvent =
  (typeof COACH_SSE_EVENTS)[keyof typeof COACH_SSE_EVENTS]

export const coachUsageRatingSchemaValues = ["up", "down"] as const
export type CoachUsageRating = (typeof coachUsageRatingSchemaValues)[number]

export type CoachTurnUsage = {
  model: string
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

export type CoachTurnInput = {
  userId: string
  threadId: string
  history: ThreadMessage[]
  signal?: AbortSignal
}

/** Injected via `AppConfig.coach` like `db` (ADR-0007). */
export type CoachRuntime = {
  streamTurn(input: CoachTurnInput): AsyncIterable<CoachStreamPart>
}
