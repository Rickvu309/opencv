import { ERROR_CODES } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { coachSendErrorMessage } from "@/features/coach/coach-error.ts"
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
    ).toBe(
      "You've reached today's limit for this Coach mode. Try another mode, or come back tomorrow."
    )
  })

  it("maps a network failure", () => {
    expect(coachSendErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Couldn't reach the Coach. Check your connection and try again."
    )
  })

  it.each([
    [404, "USER_NOT_FOUND", "User not found."],
    [404, ERROR_CODES.NOT_FOUND, "Chat not found"],
    [401, ERROR_CODES.UNAUTHORIZED, "Authentication required"],
    [403, ERROR_CODES.FORBIDDEN, "Forbidden"],
    [403, ERROR_CODES.COACH_NOT_ALLOWED, "This Command cannot be run"],
    [
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "text: String must contain 1 character",
    ],
    [500, ERROR_CODES.INTERNAL_ERROR, "SQLSTATE 23505 duplicate key"],
    [502, "REQUEST_FAILED", "Request failed with 502"],
    [418, "SOMETHING_NEW", "teapot exploded"],
  ])("never shows the raw message for %i %s", (status, code, raw) => {
    const sentence = coachSendErrorMessage(new ApiError(status, code, raw))
    expect(sentence).not.toContain(raw)
    expect(sentence).toMatch(/^[A-Z].*[.]$/)
    expect(sentence.split(/(?<=[.])\s+/).length).toBeGreaterThanOrEqual(2)
  })

  it("tells the person to sign in again when the session ended", () => {
    expect(
      coachSendErrorMessage(new ApiError(401, ERROR_CODES.UNAUTHORIZED, "x"))
    ).toMatch(/sign in again/i)
  })

  it("points a missing account at signing in again, not at the Chat", () => {
    const sentence = coachSendErrorMessage(
      new ApiError(404, "USER_NOT_FOUND", "User not found.")
    )
    expect(sentence).toMatch(/account/)
    expect(sentence).toMatch(/sign in again/i)
    expect(sentence).not.toMatch(/Chat/)
  })

  it("tells the person to reload or start a new Chat when a record is missing", () => {
    expect(
      coachSendErrorMessage(
        new ApiError(404, ERROR_CODES.NOT_FOUND, "Chat not found")
      )
    ).toMatch(/new chat/)
  })

  it("never shows a thrown Error's message", () => {
    const sentence = coachSendErrorMessage(new Error("boom: stack trace"))
    expect(sentence).not.toContain("boom")
    expect(sentence).toBe("Something went wrong sending that. Try again.")
  })

  it("falls back for a value that is not an Error", () => {
    expect(coachSendErrorMessage("nope")).toBe(
      "Something went wrong sending that. Try again."
    )
  })
})
