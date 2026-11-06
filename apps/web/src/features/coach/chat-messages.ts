import {
  titleFrom,
  type ChatEntry,
  type ChatEntryPart,
  type ChatMessageStatus,
  type ChatRecord,
} from "@workspace/domain"

export { titleFrom }

export const STREAMING_COACH_ID = "local-coach"

export type MessageRole = "coach" | "user"

export type ChatMessageAttachment = {
  kind: "job" | "paper" | "link" | "file"
  id: string
  label: string
}

export type CoachChatEntry = ChatEntry & {
  attachments?: ChatMessageAttachment[]
}

export type CoachChatRecord = Omit<ChatRecord, "messages"> & {
  messages: CoachChatEntry[]
  activeTaskId?: string | null
}

export type ChatViewMessage = {
  id: string
  role: MessageRole
  text: string
  workedMs?: number
  status?: ChatMessageStatus
  parts?: ChatEntryPart[]
  attachments?: ChatMessageAttachment[]
  failed?: boolean
  error?: string
}

export function latestCoachMessageId(
  messages: readonly ChatViewMessage[]
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === "coach" && message.id !== STREAMING_COACH_ID) {
      return message.id
    }
  }
  return null
}

export function toChatViewMessages(
  messages: ReadonlyArray<{
    id: string
    role: MessageRole
    text: string
    workedMs?: number
    status?: ChatMessageStatus
    parts?: ChatEntryPart[]
    attachments?: ChatMessageAttachment[]
  }>
): ChatViewMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    ...(message.workedMs != null ? { workedMs: message.workedMs } : {}),
    ...(message.status ? { status: message.status } : {}),
    ...(message.parts ? { parts: message.parts } : {}),
    ...(message.attachments ? { attachments: message.attachments } : {}),
  }))
}
