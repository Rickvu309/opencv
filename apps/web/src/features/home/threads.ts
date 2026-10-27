import {
  titleFrom,
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
  failed?: boolean
  error?: string
}

export function latestCoachMessageId(
  messages: readonly HomeMessage[]
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === "coach" && message.id !== STREAMING_COACH_ID) {
      return message.id
    }
  }
  return null
}

export function toHomeMessages(
  messages: ReadonlyArray<{
    id: string
    role: MessageRole
    text: string
    workedMs?: number
    status?: ThreadMessageStatus
    parts?: ThreadMessagePart[]
  }>
): HomeMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    ...(message.workedMs != null ? { workedMs: message.workedMs } : {}),
    ...(message.status ? { status: message.status } : {}),
    ...(message.parts ? { parts: message.parts } : {}),
  }))
}
