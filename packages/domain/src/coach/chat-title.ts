import { CHAT_TITLE_MAX } from "./chat.js"
import { DEFAULT_CHAT_TITLE } from "./chat-messages.js"

const FIRST_LINE_TITLE_MAX = 36

const AUTO_CHAT_TITLE_MAX = 48

const CLAIMED_ACTION_START =
  /^(?:i\s+)?(?:successfully\s+)?(?:moved|created|renamed|updated|starred|unstarred|added|set|linked|posted|wrote|edited|saved|changed|done)\b/i

const GREETING_ONLY =
  /^(?:hi|hello|hey|yo|sup|thanks|thank you)(?:\s+there)?[?.]*$/i

const LEAD_IN =
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:help\s+(?:me|us)\s+(?:to\s+)?)?(?:should\s+i\s+|can\s+i\s+|could\s+i\s+|do\s+i\s+|how\s+do\s+i\s+|how\s+can\s+i\s+|what(?:'s| is)\s+|i\s+want\s+to\s+|i\s+need\s+to\s+)?/i

type ChatTitleTurn = {
  userText: string
  coachText: string
}

type ChatTitleCandidate = {
  role: "user" | "coach"
  text: string
  status?: string | null
}

export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= FIRST_LINE_TITLE_MAX) return clean
  return `${clean.slice(0, FIRST_LINE_TITLE_MAX)}…`
}

function isDefaultChatTitle(title: string) {
  return title.trim() === DEFAULT_CHAT_TITLE
}

function isFirstLineChatTitle(title: string, firstUserText: string) {
  return title.trim() === titleFrom(firstUserText)
}

function isAutoTitleEligible(title: string, firstUserText: string) {
  return isDefaultChatTitle(title) || isFirstLineChatTitle(title, firstUserText)
}

function hasCompletedCoachTurn(messages: readonly ChatTitleCandidate[]) {
  return messages.some(
    (message) =>
      message.role === "coach" &&
      (message.status === "final" || message.status == null)
  )
}

export function shouldAutoTitleChat(input: {
  currentTitle: string
  messages: readonly ChatTitleCandidate[]
  status: string
}): { userText: string } | null {
  if (input.status !== "final") return null
  if (hasCompletedCoachTurn(input.messages)) return null

  const firstUser = input.messages.find((message) => message.role === "user")
  if (!firstUser?.text.trim()) return null
  if (!isAutoTitleEligible(input.currentTitle, firstUser.text)) return null

  return { userText: firstUser.text }
}

function sanitizeChatTitle(raw: string): string {
  const stripped = raw
    .replace(/!/g, "")
    .replace(/^[\s"'“”‘’`]+|[\s"'“”‘’`]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.?]+$/g, "")
    .trim()

  if (!stripped) return ""
  if (CLAIMED_ACTION_START.test(stripped)) return ""

  const clipped = clipTitle(stripped)
  if (!clipped) return ""
  if (clipped.length > CHAT_TITLE_MAX) {
    return clipTitle(clipped.slice(0, CHAT_TITLE_MAX))
  }
  return clipped
}

export function deterministicChatTitle({
  userText,
  coachText,
}: ChatTitleTurn): string {
  const fromUser = titleFromTopic(userText)
  if (fromUser && !GREETING_ONLY.test(fromUser)) return fromUser

  const fromCoach = titleFromTopic(firstSentence(coachText))
  if (fromCoach) return fromCoach

  return (
    sanitizeChatTitle(titleFrom(userText)) ||
    sanitizeChatTitle(titleFrom(coachText)) ||
    DEFAULT_CHAT_TITLE
  )
}

function titleFromTopic(text: string) {
  const cleaned = sanitizeChatTitle(text)
  if (!cleaned) return ""
  const withoutLeadIn = cleaned.replace(LEAD_IN, "").trim()
  const topic = sanitizeChatTitle(withoutLeadIn) || cleaned
  return sentenceCase(topic)
}

function firstSentence(text: string) {
  const match = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/^[^.?\n]+/)
  return match?.[0]?.trim() ?? text
}

function sentenceCase(text: string) {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function clipTitle(text: string) {
  if (text.length <= AUTO_CHAT_TITLE_MAX) return text
  const slice = text.slice(0, AUTO_CHAT_TITLE_MAX)
  const atWord = slice.lastIndexOf(" ")
  const clipped = (atWord >= 16 ? slice.slice(0, atWord) : slice).trim()
  return clipped.replace(/[,:;.-]+$/g, "")
}
