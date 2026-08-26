import { describe, expect, it } from "vitest"

import { titleFrom } from "@workspace/domain"

import { toHomeMessages } from "@/features/home/threads.ts"

describe("titleFrom", () => {
  it("keeps short text and trims long titles", () => {
    expect(titleFrom("  Help me plan the week  ")).toBe("Help me plan the week")
    expect(titleFrom("x".repeat(40))).toBe(`${"x".repeat(36)}…`)
  })
})

describe("toHomeMessages", () => {
  it("copies server messages including parts, rating, and worked time", () => {
    const parts = [
      { type: "text" as const, text: "Hi" },
      {
        type: "tool" as const,
        name: "apply_moveCard",
        summary: "Moved 'Backend Intern' to Prep",
        ok: true,
      },
    ]
    const mapped = toHomeMessages([
      { id: "u1", role: "user", text: "Hello" },
      {
        id: "c1",
        role: "coach",
        text: "Hi",
        workedMs: 800,
        status: "final",
        parts,
        rating: null,
      },
      { id: "u2", role: "user", text: "Again" },
      {
        id: "c2",
        role: "coach",
        text: "Still here",
        workedMs: 1400,
        status: "final",
        rating: "up",
      },
    ])

    expect(mapped[1]).toEqual({
      id: "c1",
      role: "coach",
      text: "Hi",
      workedMs: 800,
      status: "final",
      parts,
      rating: null,
    })
    expect(mapped[3]).toEqual({
      id: "c2",
      role: "coach",
      text: "Still here",
      workedMs: 1400,
      status: "final",
      rating: "up",
    })
  })
})
