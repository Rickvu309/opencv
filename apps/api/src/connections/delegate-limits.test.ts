import { expect, it } from "vitest"
import { createDelegateCallLimiter, delegateCallLimitReached } from "./http.js"

it("detects a full live window and permits clean and expired windows", () => {
  expect(
    delegateCallLimitReached({ startedAt: 0, calls: 60 }, 59_999, 60)
  ).toBe(true)
  expect(
    delegateCallLimitReached({ startedAt: 0, calls: 59 }, 59_999, 60)
  ).toBe(false)
  expect(
    delegateCallLimitReached({ startedAt: 0, calls: 60 }, 60_000, 60)
  ).toBe(false)
  expect(delegateCallLimitReached(undefined, 0, 60)).toBe(false)
})

it("limits each connection and the owner across connections and resets after a minute", () => {
  const consume = createDelegateCallLimiter()
  for (let call = 0; call < 60; call += 1) consume("owner", "first", 0)
  expect(() => consume("owner", "first", 1)).toThrow("rate limit")
  for (let call = 0; call < 60; call += 1) consume("owner", "second", 1)
  expect(() => consume("owner", "third", 2)).toThrow("rate limit")
  expect(() => consume("other-owner", "other-connection", 2)).not.toThrow()
  expect(() => consume("owner", "first", 60_001)).not.toThrow()
})
