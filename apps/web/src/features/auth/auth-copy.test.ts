import { describe, expect, it } from "vitest"

import { retryAfterMinutes } from "@/lib/retry-after.ts"

import {
  AUTH_COPY,
  LONGEST_SHOWN_WAIT_MINUTES,
  tooManyCodesText,
} from "./auth-copy.ts"

const NOW = Date.parse("2026-11-12T10:00:00Z")

describe("tooManyCodesText", () => {
  it("rounds up to whole minutes under an hour with the right plural", () => {
    expect(tooManyCodesText(1)).toBe(
      "Too many codes. Try again in about 1 minute."
    )
    expect(tooManyCodesText(2)).toBe(
      "Too many codes. Try again in about 2 minutes."
    )
    expect(tooManyCodesText(59)).toBe(
      "Too many codes. Try again in about 59 minutes."
    )
  })

  it("rounds up to whole hours from an hour to a day", () => {
    expect(tooManyCodesText(60)).toBe(
      "Too many codes. Try again in about 1 hour."
    )
    expect(tooManyCodesText(61)).toBe(
      "Too many codes. Try again in about 2 hours."
    )
    expect(tooManyCodesText(LONGEST_SHOWN_WAIT_MINUTES)).toBe(
      "Too many codes. Try again in about 24 hours."
    )
  })

  it("says tomorrow above a day and the plain line for no wait", () => {
    expect(tooManyCodesText(LONGEST_SHOWN_WAIT_MINUTES + 1)).toBe(
      AUTH_COPY.tooManyCodesTomorrow
    )
    expect(
      tooManyCodesText(retryAfterMinutes("99999999999999999999", NOW))
    ).toBe(AUTH_COPY.tooManyCodesTomorrow)
    expect(tooManyCodesText(null)).toBe(AUTH_COPY.tooManyCodes)
    expect(tooManyCodesText(Number.POSITIVE_INFINITY)).toBe(
      AUTH_COPY.tooManyCodes
    )
    expect(tooManyCodesText(0)).toBe(AUTH_COPY.tooManyCodes)
  })
})
