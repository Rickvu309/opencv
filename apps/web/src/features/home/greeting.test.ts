import { describe, expect, it } from "vitest"

import { SAMPLE_AUTHOR_NAME } from "@/features/seed/sample-author.ts"
import { greetingPhrase, homeGreeting } from "@/features/home/greeting.ts"

describe("home greeting", () => {
  it("uses Good morning for morning ICT hours even when UTC is overnight", () => {
    // 09:18 ICT = 02:18 UTC — the live Scout miss that showed Good evening.
    const morningIct = new Date("2026-09-21T02:18:00.000Z")
    expect(greetingPhrase(morningIct)).toBe("Good morning")
    expect(homeGreeting(SAMPLE_AUTHOR_NAME, morningIct)).toBe(
      `Good morning, ${SAMPLE_AUTHOR_NAME}`
    )
  })

  it("uses Good afternoon from noon until 17:00 ICT", () => {
    expect(greetingPhrase(new Date("2026-09-21T05:00:00.000Z"))).toBe(
      "Good afternoon"
    )
    expect(greetingPhrase(new Date("2026-09-21T09:59:00.000Z"))).toBe(
      "Good afternoon"
    )
  })

  it("uses Good evening from 17:00 ICT", () => {
    expect(greetingPhrase(new Date("2026-09-21T10:00:00.000Z"))).toBe(
      "Good evening"
    )
    expect(greetingPhrase(new Date("2026-09-21T14:00:00.000Z"))).toBe(
      "Good evening"
    )
  })

  it("greets the given name, not the demo persona", () => {
    expect(SAMPLE_AUTHOR_NAME).not.toMatch(/Eric/i)
    expect(homeGreeting(SAMPLE_AUTHOR_NAME)).toMatch(
      new RegExp(
        `^Good (morning|afternoon|evening), ${SAMPLE_AUTHOR_NAME}$`
      )
    )
  })
})
