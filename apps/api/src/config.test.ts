import { describe, expect, it } from "vitest"

import {
  DEFAULT_COACH_DAILY_TURN_LIMIT,
  DEFAULT_COACH_MODEL,
} from "@workspace/domain"

import {
  authUrlFromEnv,
  coachDailyTurnLimitFromEnv,
  coachModelFromEnv,
  coachRuntimeModeFromEnv,
  databaseUrlFromEnv,
  openRouterApiKeyFromEnv,
  sessionSecretFromEnv,
  webOriginsFromEnv,
} from "./config.js"

describe("webOriginsFromEnv", () => {
  it("reads a comma-separated WEB_ORIGINS list, ignoring blanks and padding", () => {
    expect(
      webOriginsFromEnv({
        WEB_ORIGINS:
          " https://openpath-app.vercel.app , https://openpath-*-rickvudev.vercel.app ,, ",
      })
    ).toEqual([
      "https://openpath-app.vercel.app",
      "https://openpath-*-rickvudev.vercel.app",
    ])
  })

  it("falls back to the local web dev server when WEB_ORIGINS is unset", () => {
    expect(webOriginsFromEnv({})).toEqual(["http://localhost:5173"])
  })
})

describe("databaseUrlFromEnv", () => {
  it("reads DATABASE_URL, ignoring padding", () => {
    expect(
      databaseUrlFromEnv({
        DATABASE_URL: "  postgresql://user:pass@localhost:5432/openpath  ",
      })
    ).toBe("postgresql://user:pass@localhost:5432/openpath")
  })

  it("returns undefined when DATABASE_URL is unset or blank", () => {
    expect(databaseUrlFromEnv({})).toBeUndefined()
    expect(databaseUrlFromEnv({ DATABASE_URL: "   " })).toBeUndefined()
  })
})

describe("sessionSecretFromEnv", () => {
  it("reads SESSION_SECRET, ignoring padding", () => {
    expect(
      sessionSecretFromEnv({ SESSION_SECRET: "  super-secret-value  " })
    ).toBe("super-secret-value")
  })

  it("returns undefined when SESSION_SECRET is unset or blank", () => {
    expect(sessionSecretFromEnv({})).toBeUndefined()
    expect(sessionSecretFromEnv({ SESSION_SECRET: "   " })).toBeUndefined()
  })
})

describe("authUrlFromEnv", () => {
  it("reads AUTH_URL, ignoring padding", () => {
    expect(authUrlFromEnv({ AUTH_URL: "  https://api.example.com  " })).toBe(
      "https://api.example.com"
    )
  })

  it("falls back to the local api when AUTH_URL is unset or blank", () => {
    expect(authUrlFromEnv({})).toBe("http://localhost:3001")
    expect(authUrlFromEnv({ AUTH_URL: "   " })).toBe("http://localhost:3001")
  })
})

describe("openRouterApiKeyFromEnv", () => {
  it("reads OPENROUTER_API_KEY, ignoring padding", () => {
    expect(
      openRouterApiKeyFromEnv({ OPENROUTER_API_KEY: "  sk-or-test-key  " })
    ).toBe("sk-or-test-key")
  })

  it("returns undefined when OPENROUTER_API_KEY is unset or blank", () => {
    expect(openRouterApiKeyFromEnv({})).toBeUndefined()
    expect(
      openRouterApiKeyFromEnv({ OPENROUTER_API_KEY: "   " })
    ).toBeUndefined()
  })
})

describe("coachModelFromEnv", () => {
  it("reads COACH_MODEL, ignoring padding", () => {
    expect(coachModelFromEnv({ COACH_MODEL: "  openai/gpt-5  " })).toBe(
      "openai/gpt-5"
    )
  })

  it("falls back to Claude Sonnet 4.5 when COACH_MODEL is unset or blank", () => {
    expect(coachModelFromEnv({})).toBe(DEFAULT_COACH_MODEL)
    expect(coachModelFromEnv({ COACH_MODEL: "   " })).toBe(DEFAULT_COACH_MODEL)
    expect(DEFAULT_COACH_MODEL).toBe("anthropic/claude-sonnet-4.5")
  })
})

describe("coachDailyTurnLimitFromEnv", () => {
  it("reads a positive integer COACH_DAILY_TURN_LIMIT, ignoring padding", () => {
    expect(
      coachDailyTurnLimitFromEnv({ COACH_DAILY_TURN_LIMIT: "  12  " })
    ).toBe(12)
  })

  it("falls back to 50 when unset, blank, or not a positive integer", () => {
    expect(coachDailyTurnLimitFromEnv({})).toBe(DEFAULT_COACH_DAILY_TURN_LIMIT)
    expect(coachDailyTurnLimitFromEnv({ COACH_DAILY_TURN_LIMIT: "   " })).toBe(
      DEFAULT_COACH_DAILY_TURN_LIMIT
    )
    expect(coachDailyTurnLimitFromEnv({ COACH_DAILY_TURN_LIMIT: "0" })).toBe(
      DEFAULT_COACH_DAILY_TURN_LIMIT
    )
    expect(coachDailyTurnLimitFromEnv({ COACH_DAILY_TURN_LIMIT: "-3" })).toBe(
      DEFAULT_COACH_DAILY_TURN_LIMIT
    )
    expect(coachDailyTurnLimitFromEnv({ COACH_DAILY_TURN_LIMIT: "1.5" })).toBe(
      DEFAULT_COACH_DAILY_TURN_LIMIT
    )
    expect(coachDailyTurnLimitFromEnv({ COACH_DAILY_TURN_LIMIT: "nope" })).toBe(
      DEFAULT_COACH_DAILY_TURN_LIMIT
    )
    expect(DEFAULT_COACH_DAILY_TURN_LIMIT).toBe(50)
  })
})

describe("coachRuntimeModeFromEnv", () => {
  it("reads the scripted fake mode and ignores anything else", () => {
    expect(coachRuntimeModeFromEnv({ COACH_RUNTIME: "  fake  " })).toBe("fake")
    expect(coachRuntimeModeFromEnv({})).toBeUndefined()
    expect(
      coachRuntimeModeFromEnv({ COACH_RUNTIME: "openrouter" })
    ).toBeUndefined()
    expect(coachRuntimeModeFromEnv({ COACH_RUNTIME: "   " })).toBeUndefined()
  })
})
