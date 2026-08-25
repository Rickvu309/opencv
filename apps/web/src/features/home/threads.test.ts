import { describe, expect, it } from "vitest"

import { titleFrom, toHomeMessages } from "@/features/home/threads.ts"

describe("titleFrom", () => {
  it("keeps short text and trims long titles", () => {
    expect(titleFrom("  Help me plan the week  ")).toBe("Help me plan the week")
    expect(titleFrom("x".repeat(40))).toBe(`${"x".repeat(36)}…`)
  })
})

describe("toHomeMessages", () => {
  it("copies server messages including worked time from the Coach row", () => {
    const mapped = toHomeMessages([
      { id: "u1", role: "user", text: "Hello" },
      { id: "c1", role: "coach", text: "Hi", workedMs: 800, status: "final" },
      { id: "u2", role: "user", text: "Again" },
      {
        id: "c2",
        role: "coach",
        text: "Still here",
        workedMs: 1400,
        status: "final",
      },
    ])

    expect(mapped[1]).toEqual({
      id: "c1",
      role: "coach",
      text: "Hi",
      workedMs: 800,
      status: "final",
    })
    expect(mapped[3]).toEqual({
      id: "c2",
      role: "coach",
      text: "Still here",
      workedMs: 1400,
      status: "final",
    })
  })
})
