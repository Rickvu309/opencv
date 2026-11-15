import { describe, expect, it, vi } from "vitest"

import { retryAfterMinutes } from "@/lib/retry-after.ts"

import {
  AUTH_COPY,
  LANGUAGE_STORAGE_KEY,
  LONGEST_SHOWN_WAIT_MINUTES,
  readLanguage,
  tooManyCodesText,
} from "./auth-copy.ts"

const NOW = Date.parse("2026-11-12T10:00:00Z")

describe("readLanguage", () => {
  it.each([
    [null, "en"],
    ["en", "en"],
    ["vi", "vi"],
    ["unknown", "en"],
  ])("reads %s as %s", (stored, expected) => {
    if (stored === null) sessionStorage.removeItem(LANGUAGE_STORAGE_KEY)
    else sessionStorage.setItem(LANGUAGE_STORAGE_KEY, stored)
    expect(readLanguage()).toBe(expected)
  })

  it("uses English when the session storage getter is denied", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "sessionStorage"
    )
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError")
      },
    })
    try {
      expect(readLanguage()).toBe("en")
    } finally {
      if (descriptor)
        Object.defineProperty(globalThis, "sessionStorage", descriptor)
      else Reflect.deleteProperty(globalThis, "sessionStorage")
    }
  })

  it("uses English when reading the session preference is denied", () => {
    const read = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError")
      })
    try {
      expect(readLanguage()).toBe("en")
    } finally {
      read.mockRestore()
    }
  })
})

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
