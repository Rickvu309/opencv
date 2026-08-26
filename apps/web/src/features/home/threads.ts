import {
  titleFrom,
  type CoachUsageRating,
  type ThreadMessagePart,
  type ThreadMessageStatus,
} from "@workspace/domain"

export { titleFrom }

export const HISTORY_PREVIEW_COUNT = 4

export const STREAMING_COACH_ID = "local-coach"

export type MessageRole = "coach" | "user"

export type HomeMessage = {
  id: string
  role: MessageRole
  text: string
  workedMs?: number
  status?: ThreadMessageStatus
  parts?: ThreadMessagePart[]
  rating?: CoachUsageRating | null
  failed?: boolean
  error?: string
}

export function toHomeMessages(
  messages: ReadonlyArray<{
    id: string
    role: MessageRole
    text: string
    workedMs?: number
    status?: ThreadMessageStatus
    parts?: ThreadMessagePart[]
    rating?: CoachUsageRating | null
  }>
): HomeMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    ...(message.workedMs != null ? { workedMs: message.workedMs } : {}),
    ...(message.status ? { status: message.status } : {}),
    ...(message.parts ? { parts: message.parts } : {}),
    ...(message.rating !== undefined ? { rating: message.rating } : {}),
  }))
}
