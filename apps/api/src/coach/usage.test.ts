import { describe, expect, it } from "vitest"

import { startOfUtcDay } from "./usage.js"

describe("startOfUtcDay", () => {
  it("returns midnight UTC for the given instant", () => {
    expect(
      startOfUtcDay(new Date("2026-08-25T15:04:05.123Z")).toISOString()
    ).toBe("2026-08-25T00:00:00.000Z")
  })
})
