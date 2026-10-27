import { ERROR_CODES } from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"

const SIGN_IN_AGAIN =
  "Something went wrong: the Coach couldn't find your account. Sign in again, then retry."
const GENERIC = "Something went wrong sending that. Try again."
const UNAVAILABLE = "The Coach is unavailable right now. Try again in a moment."

function apiErrorSentence(error: ApiError): string {
  switch (error.code) {
    case ERROR_CODES.COACH_UNAVAILABLE:
    case ERROR_CODES.AUTH_UNAVAILABLE:
    case ERROR_CODES.INTERNAL_ERROR:
      return UNAVAILABLE
    case ERROR_CODES.COACH_LIMIT_REACHED:
      return "You've reached today's limit for this Coach mode. Try another mode, or come back tomorrow."
    case ERROR_CODES.UNAUTHORIZED:
      return "Your session ended, so the Coach couldn't answer. Sign in again, then retry."
    case "USER_NOT_FOUND":
      return SIGN_IN_AGAIN
    case ERROR_CODES.FORBIDDEN:
    case ERROR_CODES.COACH_NOT_ALLOWED:
      return "The Coach can't do that here. Ask for something else, or make the change yourself."
    case ERROR_CODES.VALIDATION_ERROR:
      return "The Coach couldn't read that message. Shorten it or reword it, then send it again."
    default:
      break
  }

  if (error.status === 401) {
    return "Your session ended, so the Coach couldn't answer. Sign in again, then retry."
  }
  if (error.status === 404) {
    return "Something went wrong: the Coach couldn't find your Chat. Reload the page, or start a new Chat."
  }
  if (error.status === 429) {
    return "The Coach is getting too many requests. Wait a moment, then retry."
  }
  if (error.status >= 500) return UNAVAILABLE
  return GENERIC
}

export function coachSendErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return apiErrorSentence(error)

  if (error instanceof TypeError) {
    return "Couldn't reach the Coach. Check your connection and try again."
  }

  return GENERIC
}

const STREAM_SENTENCES = new Set([
  UNAVAILABLE,
  GENERIC,
  "You've reached today's limit for this Coach mode. Try another mode, or come back tomorrow.",
  "Your session ended, so the Coach couldn't answer. Sign in again, then retry.",
  SIGN_IN_AGAIN,
  "The Coach can't do that here. Ask for something else, or make the change yourself.",
  "The Coach couldn't read that message. Shorten it or reword it, then send it again.",
  "Something went wrong: the Coach couldn't find your Chat. Reload the page, or start a new Chat.",
  "The Coach is getting too many requests. Wait a moment, then retry.",
  "Couldn't reach the Coach. Check your connection and try again.",
  "The edit did not save. Ask again and I will update the document.",
  "The Coach is unavailable right now",
])

/** SSE errors are codes or a sentence we already show. Anything else stays off the page. */
export function coachStreamErrorMessage(message: string): string {
  const trimmed = message.trim()
  if (/^[A-Z0-9_]+$/.test(trimmed)) {
    return coachSendErrorMessage(new ApiError(500, trimmed, trimmed))
  }
  if (STREAM_SENTENCES.has(trimmed)) return trimmed
  return GENERIC
}
