import { describe, expect, it } from "vitest"

import { DEFAULT_DEV_PROFILE_NAME } from "@/features/app-shell/dev-profile.ts"
import { greetingPhrase, homeGreeting } from "@/features/home/greeting.ts"

describe("home greeting", () => {
  it("uses Good morning before noon", () => {
    expect(greetingPhrase(new Date("2026-08-24T08:00:00"))).toBe("Good morning")
    expect(
      homeGreeting(DEFAULT_DEV_PROFILE_NAME, new Date("2026-08-24T08:00:00"))
    ).toBe(`Good morning, ${DEFAULT_DEV_PROFILE_NAME}`)
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
    expect(DEFAULT_DEV_PROFILE_NAME).not.toMatch(/Eric/i)
    expect(homeGreeting()).toMatch(
      new RegExp(
        `^Good (morning|afternoon|evening), ${DEFAULT_DEV_PROFILE_NAME}$`
      )
    )
  })
})
