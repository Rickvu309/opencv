export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  AUTH_UNAVAILABLE: "AUTH_UNAVAILABLE",
  UNKNOWN_COMMAND: "UNKNOWN_COMMAND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  COACH_NOT_ALLOWED: "COACH_NOT_ALLOWED",
  COACH_UNAVAILABLE: "COACH_UNAVAILABLE",
  COACH_LIMIT_REACHED: "COACH_LIMIT_REACHED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export type ErrorEnvelope = {
  ok: false
  error: {
    code: string
    message: string
  }
}

export type SuccessEnvelope<T> = {
  ok: true
  data: T
}

export type CommandEnvelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope

export function errorEnvelope(code: string, message: string): ErrorEnvelope {
  return { ok: false, error: { code, message } }
}

export function successEnvelope<T>(data: T): SuccessEnvelope<T> {
  return { ok: true, data }
}

export function unauthorizedEnvelope() {
  return errorEnvelope(ERROR_CODES.UNAUTHORIZED, "Authentication required")
}

export function authUnavailableEnvelope() {
  return errorEnvelope(
    ERROR_CODES.AUTH_UNAVAILABLE,
    "Authentication is not configured"
  )
}

export function coachUnavailableEnvelope() {
  return errorEnvelope(
    ERROR_CODES.COACH_UNAVAILABLE,
    "The Coach is unavailable right now"
  )
}

export function coachLimitReachedEnvelope() {
  return errorEnvelope(
    ERROR_CODES.COACH_LIMIT_REACHED,
    "You've reached today's Coach turn limit"
  )
}

export function httpStatusForError(code: string): number {
  switch (code) {
    case ERROR_CODES.UNAUTHORIZED:
      return 401
    case ERROR_CODES.AUTH_UNAVAILABLE:
    case ERROR_CODES.COACH_UNAVAILABLE:
      return 503
    case ERROR_CODES.VALIDATION_ERROR:
      return 400
    case ERROR_CODES.FORBIDDEN:
    case ERROR_CODES.COACH_NOT_ALLOWED:
      return 403
    case ERROR_CODES.UNKNOWN_COMMAND:
    case ERROR_CODES.NOT_FOUND:
      return 404
    case ERROR_CODES.COACH_LIMIT_REACHED:
      return 429
    case ERROR_CODES.INTERNAL_ERROR:
      return 500
    default:
      return 400
  }
}
