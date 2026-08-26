import { DEFAULT_THREAD_TITLE, THREAD_TITLE_MAX } from "./threads.js"

/** First-line History title taken from the User's opening message. */
export const FIRST_LINE_TITLE_MAX = 36

/** Generated titles stay short enough to scan in History. */
export const AUTO_THREAD_TITLE_MAX = 48

const CLAIMED_ACTION_START =
  /^(?:i\s+)?(?:successfully\s+)?(?:moved|created|renamed|updated|starred|unstarred|added|set|linked|posted|wrote|edited|saved|changed|done)\b/i

const GREETING_ONLY =
  /^(?:hi|hello|hey|yo|sup|thanks|thank you)(?:\s+there)?[?.]*$/i

const LEAD_IN =
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:help\s+(?:me|us)\s+(?:to\s+)?)?(?:should\s+i\s+|can\s+i\s+|could\s+i\s+|do\s+i\s+|how\s+do\s+i\s+|how\s+can\s+i\s+|what(?:'s| is)\s+|i\s+want\s+to\s+|i\s+need\s+to\s+)?/i

export type ThreadTitleTurn = {
  userText: string
  coachText: string
}

export type ThreadTitleCandidate = {
  role: "user" | "coach"
  text: string
  status?: string | null
}

/**
 * First-line title used when a Thread is created from the composer.
 * Distinct from the generated title that replaces it after the first turn.
 */
export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= FIRST_LINE_TITLE_MAX) return clean
  return `${clean.slice(0, FIRST_LINE_TITLE_MAX)}…`
}

export function isDefaultThreadTitle(title: string) {
  return title.trim() === DEFAULT_THREAD_TITLE
}

export function isFirstLineThreadTitle(title: string, firstUserText: string) {
  return title.trim() === titleFrom(firstUserText)
}

/** Default or first-line titles may be replaced. User-renamed titles may not. */
export function isAutoTitleEligible(title: string, firstUserText: string) {
  return (
    isDefaultThreadTitle(title) || isFirstLineThreadTitle(title, firstUserText)
  )
}

/**
 * A completed Coach turn is a `final` row, or a seed/legacy coach row with no
 * status. Aborted and error turns do not count, so a later successful turn
 * can still title the Thread.
 */
export function hasCompletedCoachTurn(
  messages: readonly ThreadTitleCandidate[]
) {
  return messages.some(
    (message) =>
      message.role === "coach" &&
      (message.status === "final" || message.status == null)
  )
}

export function shouldAutoTitleThread(input: {
  currentTitle: string
  messages: readonly ThreadTitleCandidate[]
  status: string
}): { userText: string } | null {
  if (input.status !== "final") return null
  if (hasCompletedCoachTurn(input.messages)) return null

  const firstUser = input.messages.find((message) => message.role === "user")
  if (!firstUser?.text.trim()) return null
  if (!isAutoTitleEligible(input.currentTitle, firstUser.text)) return null

  return { userText: firstUser.text }
}

export function sanitizeThreadTitle(raw: string): string {
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
  if (clipped.length > THREAD_TITLE_MAX) {
    return clipTitle(clipped.slice(0, THREAD_TITLE_MAX))
  }
  return clipped
}

export function deterministicThreadTitle({
  userText,
  coachText,
}: ThreadTitleTurn): string {
  const fromUser = titleFromTopic(userText)
  if (fromUser && !GREETING_ONLY.test(fromUser)) return fromUser

  const fromCoach = titleFromTopic(firstSentence(coachText))
  if (fromCoach) return fromCoach

  return (
    sanitizeThreadTitle(titleFrom(userText)) ||
    sanitizeThreadTitle(titleFrom(coachText)) ||
    DEFAULT_THREAD_TITLE
  )
}

function titleFromTopic(text: string) {
  const cleaned = sanitizeThreadTitle(text)
  if (!cleaned) return ""
  const withoutLeadIn = cleaned.replace(LEAD_IN, "").trim()
  const topic = sanitizeThreadTitle(withoutLeadIn) || cleaned
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
  if (text.length <= AUTO_THREAD_TITLE_MAX) return text
  const slice = text.slice(0, AUTO_THREAD_TITLE_MAX)
  const atWord = slice.lastIndexOf(" ")
  const clipped = (atWord >= 16 ? slice.slice(0, atWord) : slice).trim()
  return clipped.replace(/[,:;.-]+$/g, "")
}
