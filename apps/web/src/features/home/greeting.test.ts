import { describe, expect, it } from "vitest"

import { PLACEHOLDER_USER_NAME } from "@/features/app-shell/placeholder-user.ts"
import { greetingPhrase, homeGreeting } from "@/features/home/greeting.ts"

describe("home greeting", () => {
  it("uses Good morning before noon", () => {
    expect(greetingPhrase(new Date("2026-08-24T08:00:00"))).toBe("Good morning")
    expect(homeGreeting("Lan", new Date("2026-08-24T08:00:00"))).toBe(
      "Good morning, Lan"
    )
  })

  it("uses Good afternoon from noon until 17:00", () => {
    expect(greetingPhrase(new Date("2026-08-24T12:00:00"))).toBe(
      "Good afternoon"
    )
    expect(greetingPhrase(new Date("2026-08-24T16:59:00"))).toBe(
      "Good afternoon"
    )
  })

  it("uses Good evening from 17:00", () => {
    expect(greetingPhrase(new Date("2026-08-24T17:00:00"))).toBe("Good evening")
    expect(greetingPhrase(new Date("2026-08-24T22:00:00"))).toBe("Good evening")
  })

  it("shows the placeholder User name, not the demo persona", () => {
    expect(PLACEHOLDER_USER_NAME).not.toMatch(/Eric/i)
    expect(homeGreeting()).toMatch(
      new RegExp(`^Good (morning|afternoon|evening), ${PLACEHOLDER_USER_NAME}$`)
    )
  })
})
