import { ERROR_CODES } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { coachSendErrorMessage } from "@/features/home/coach-error.ts"
import { ApiError } from "@/lib/api-error.ts"

describe("coachSendErrorMessage", () => {
  it("uses plain language for known Coach codes", () => {
    expect(
      coachSendErrorMessage(
        new ApiError(503, ERROR_CODES.COACH_UNAVAILABLE, "raw")
      )
    ).toBe("The Coach is unavailable right now. Try again in a moment.")
    expect(
      coachSendErrorMessage(
        new ApiError(429, ERROR_CODES.COACH_LIMIT_REACHED, "raw")
      )
    ).toBe("You've reached today's Coach limit. Come back tomorrow.")
  })

  it("maps a network failure", () => {
    expect(coachSendErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Couldn't reach the Coach. Check your connection and try again."
    )
  })
})
