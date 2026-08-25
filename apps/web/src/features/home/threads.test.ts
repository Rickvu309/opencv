import { STUB_COACH_REPLY } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { titleFrom, toHomeMessages } from "@/features/home/threads.ts"

describe("titleFrom", () => {
  it("keeps short text and trims long titles", () => {
    expect(titleFrom("  Help me plan the week  ")).toBe("Help me plan the week")
    expect(titleFrom("x".repeat(40))).toBe(`${"x".repeat(36)}…`)
  })
})

describe("stub Coach reply", () => {
  it("does not claim a Paper, Apply, or Command action", () => {
    expect(STUB_COACH_REPLY).toMatch(/haven't edited Paper or Apply/i)
    expect(STUB_COACH_REPLY).toMatch(/haven't run any Commands/i)
    expect(STUB_COACH_REPLY).not.toMatch(
      /\bI (have|'ve|just) (edited|updated|ran)\b/i
    )
  })
})

describe("toHomeMessages", () => {
  it("copies server messages and attaches thinking time to the last Coach reply", () => {
    const mapped = toHomeMessages(
      [
        { id: "u1", role: "user", text: "Hello" },
        { id: "c1", role: "coach", text: "Hi" },
        { id: "u2", role: "user", text: "Again" },
        { id: "c2", role: "coach", text: "Still here" },
      ],
      1400
    )

    expect(mapped[1]).toEqual({ id: "c1", role: "coach", text: "Hi" })
    expect(mapped[3]).toEqual({
      id: "c2",
      role: "coach",
      text: "Still here",
      workedMs: 1400,
    })
  })
})
