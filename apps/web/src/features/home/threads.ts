export { STUB_COACH_REPLY } from "@workspace/domain"

export const HISTORY_PREVIEW_COUNT = 4

export type MessageRole = "coach" | "user"

export type HomeMessage = {
  id: string
  role: MessageRole
  text: string
  workedMs?: number
}

export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= 36) return clean
  return `${clean.slice(0, 36)}…`
}

export function toHomeMessages(
  messages: ReadonlyArray<{ id: string; role: MessageRole; text: string }>,
  lastCoachWorkedMs?: number
): HomeMessage[] {
  const lastCoach = [...messages]
    .reverse()
    .find((message) => message.role === "coach")

  return messages.map((message) => {
    if (lastCoachWorkedMs != null && lastCoach && message.id === lastCoach.id) {
      return {
        id: message.id,
        role: message.role,
        text: message.text,
        workedMs: lastCoachWorkedMs,
      }
    }

    return {
      id: message.id,
      role: message.role,
      text: message.text,
    }
  })
}
