import type { CommandEnvelope } from "./envelope.js"
import type { ReversalDescriptor } from "./commands.js"
import type { ThreadMessage, ThreadMessagePart } from "./threads.js"

export const DEFAULT_COACH_MODEL = "anthropic/claude-sonnet-4.5"
export const DEFAULT_COACH_DAILY_TURN_LIMIT = 50
export const COACH_SSE_HEARTBEAT_MS = 15_000

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
}

export type CoachSseMessageEndData = {
  message: ThreadMessage
  usage: CoachTurnUsage
}

export type CoachSseErrorData = {
  message: string
}

export type CoachTurnInput = {
  userId: string
  threadId: string
  history: ThreadMessage[]
}

/** Injected via `AppConfig.coach` like `db` (ADR-0007). */
export type CoachRuntime = {
  streamTurn(input: CoachTurnInput): AsyncIterable<CoachStreamPart>
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
          toolCallId: part.toolCallId,
        },
      ]
    }
    default:
      return [...parts]
  }
}
