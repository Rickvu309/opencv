import { ERROR_CODES } from "@workspace/domain"

import { ApiError } from "@/lib/api-error.ts"

export function coachSendErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ERROR_CODES.COACH_UNAVAILABLE:
        return "The Coach is unavailable right now. Try again in a moment."
      case ERROR_CODES.COACH_LIMIT_REACHED:
        return "You've reached today's limit for this Coach mode. Try another mode, or come back tomorrow."
      default:
        return error.message || "Something went wrong sending that. Try again."
    }
  }

  if (error instanceof TypeError) {
    return "Couldn't reach the Coach. Check your connection and try again."
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Something went wrong sending that. Try again."
}
