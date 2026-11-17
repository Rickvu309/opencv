import { describe, expect, it } from "vitest"

import { chatAge } from "./chat-age.ts"

const NOW = Date.parse("2026-11-17T12:00:00Z")
const before = (minutes: number) =>
  new Date(NOW - minutes * 60000).toISOString()

describe("chatAge", () => {
  it.each([
    [0, "now", "just now"],
    [1, "1m", "1 minute ago"],
    [59, "59m", "59 minutes ago"],
    [60, "1h", "1 hour ago"],
    [60 * 23, "23h", "23 hours ago"],
    [60 * 24, "1d", "1 day ago"],
    [60 * 24 * 6, "6d", "6 days ago"],
    [60 * 24 * 7, "1w", "1 week ago"],
    [60 * 24 * 23, "3w", "3 weeks ago"],
    [60 * 24 * 30, "1mo", "1 month ago"],
    [60 * 24 * 95, "3mo", "3 months ago"],
    [60 * 24 * 400, "1y", "1 year ago"],
  ])("labels a Chat used %i minutes ago as %s", (minutes, short, long) => {
    expect(chatAge(before(minutes), NOW)).toEqual({ short, long })
  })

  it("reads a Chat stamped slightly in the future as now", () => {
    expect(chatAge(before(-3), NOW)).toEqual({
      short: "now",
      long: "just now",
    })
  })

  it("gives no age for an unreadable date", () => {
    expect(chatAge("not a date", NOW)).toBeNull()
  })
})
