import { describe, expect, it } from "vitest"

import { DEFAULT_COACH_MODELS } from "@workspace/domain"

import {
  apiPortFromEnv,
  authUrlFromEnv,
  authRateLimitEnabledFromEnv,
  coachDailyTurnLimitForModeFromEnv,
  coachModelForModeFromEnv,
  coachRuntimeModeFromEnv,
  databaseUrlFromEnv,
  logAuthMailFromEnv,
  dbDriverFromEnv,
  pgliteDataDirFromEnv,
  openRouterApiKeyFromEnv,
  openRouterBaseUrlFromEnv,
  sessionSecretFromEnv,
  webOriginsFromEnv,
} from "./config.js"

describe("logAuthMailFromEnv", () => {
  it.each([
    [{}, true],
    [{ AUTH_URL: "http://localhost:4465" }, true],
    [{ AUTH_URL: "http://127.0.0.1:4465" }, true],
    [{ AUTH_URL: "http://[::1]:4465" }, true],
    [{ NODE_ENV: "production" }, false],
    [{ NODE_ENV: "", AUTH_URL: "https://api.opencv.me" }, false],
    [{ AUTH_URL: "https://api.opencv.me" }, false],
    [{ AUTH_URL: "invalid" }, false],
  ])("uses log delivery only for local development: %j", (env, expected) => {
    expect(logAuthMailFromEnv(env)).toBe(expected)
  })
})

describe("authRateLimitEnabledFromEnv", () => {
  const verifyStack = {
    DB_DRIVER: "pglite",
    OPENCV_VERIFY_RUN: "ci-screens",
    AUTH_URL: "http://localhost:4460",
  }

  it("turns the sign-in code limiter off only for a local verify stack", () => {
    expect(authRateLimitEnabledFromEnv(verifyStack)).toBe(false)
  })

  it.each([
    [{}],
    [{ OPENCV_VERIFY_RUN: "ci-screens" }],
    [{ DB_DRIVER: "pglite" }],
    [{ ...verifyStack, NODE_ENV: "production" }],
    [{ ...verifyStack, AUTH_URL: "https://api.opencv.me" }],
    [{ ...verifyStack, DB_DRIVER: "" }],
    [{ ...verifyStack, OPENCV_VERIFY_RUN: "  " }],
    [{ NODE_ENV: "production", DATABASE_URL: "postgres://x" }],
  ])("keeps the limiter on everywhere else: %j", (env) => {
    expect(authRateLimitEnabledFromEnv(env)).toBe(true)
  })
})

describe("webOriginsFromEnv", () => {
  it("reads a comma-separated WEB_ORIGINS list, ignoring blanks and padding", () => {
    expect(
      webOriginsFromEnv({
        WEB_ORIGINS:
          " https://opencv.me , https://opencv-*-example.vercel.app ,, ",
      })
    ).toEqual(["https://opencv.me", "https://opencv-*-example.vercel.app"])
  })

  it("falls back to the local web dev server when WEB_ORIGINS is unset", () => {
    expect(webOriginsFromEnv({})).toEqual(["http://localhost:5173"])
  })
})

describe("databaseUrlFromEnv", () => {
  it("reads DATABASE_URL, ignoring padding", () => {
    expect(
      databaseUrlFromEnv({
        DATABASE_URL: "  postgresql://user:pass@localhost:5432/opencv  ",
      })
    ).toBe("postgresql://user:pass@localhost:5432/opencv")
  })

  it("returns undefined when DATABASE_URL is unset or blank", () => {
    expect(databaseUrlFromEnv({})).toBeUndefined()
    expect(databaseUrlFromEnv({ DATABASE_URL: "   " })).toBeUndefined()
  })
})

describe("dbDriverFromEnv", () => {
  it("returns pglite for DB_DRIVER=pglite, ignoring padding", () => {
    expect(dbDriverFromEnv({ DB_DRIVER: "pglite" })).toBe("pglite")
    expect(dbDriverFromEnv({ DB_DRIVER: " pglite " })).toBe("pglite")
  })

  it("returns undefined when DB_DRIVER is unset, blank or another value", () => {
    expect(dbDriverFromEnv({})).toBeUndefined()
    expect(dbDriverFromEnv({ DB_DRIVER: "   " })).toBeUndefined()
    expect(dbDriverFromEnv({ DB_DRIVER: "postgres" })).toBeUndefined()
  })
})

describe("pgliteDataDirFromEnv", () => {
  it("falls back to the default data dir when PGLITE_DATA_DIR is unset or blank", () => {
    expect(pgliteDataDirFromEnv({})).toMatch(/apps\/api\/\.data\/default$/)
    expect(pgliteDataDirFromEnv({ PGLITE_DATA_DIR: "   " })).toMatch(
      /apps\/api\/\.data\/default$/
    )
  })

  it("reads PGLITE_DATA_DIR, ignoring padding", () => {
    expect(pgliteDataDirFromEnv({ PGLITE_DATA_DIR: "  /tmp/pg  " })).toBe(
      "/tmp/pg"
    )
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

describe("openRouterBaseUrlFromEnv", () => {
  it("is unset by default, trims an http(s) URL and refuses anything else", () => {
    expect(openRouterBaseUrlFromEnv({})).toBeUndefined()
    expect(
      openRouterBaseUrlFromEnv({ OPENROUTER_BASE_URL: "  " })
    ).toBeUndefined()
    expect(
      openRouterBaseUrlFromEnv({
        OPENROUTER_BASE_URL: " http://localhost:9999/v1 ",
      })
    ).toBe("http://localhost:9999/v1")
    expect(() =>
      openRouterBaseUrlFromEnv({ OPENROUTER_BASE_URL: "file:///etc/passwd" })
    ).toThrow("OPENROUTER_BASE_URL must be an http(s) URL")
  })
})

describe("coachModelForModeFromEnv", () => {
  it("reads the per-mode vars and falls back to the mode defaults", () => {
    expect(coachModelForModeFromEnv("free", {})).toBe(DEFAULT_COACH_MODELS.free)
    expect(coachModelForModeFromEnv("light", {})).toBe(
      DEFAULT_COACH_MODELS.light
    )
    expect(coachModelForModeFromEnv("max", {})).toBe(DEFAULT_COACH_MODELS.max)
    expect(
      coachModelForModeFromEnv("max", {
        COACH_MODEL_MAX: "  anthropic/claude-fable-5  ",
      })
    ).toBe("anthropic/claude-fable-5")
  })
})

describe("coachDailyTurnLimitForModeFromEnv", () => {
  it("reads per-mode caps and falls back to the mode default", () => {
    expect(coachDailyTurnLimitForModeFromEnv("light", {})).toBe(30)
    expect(
      coachDailyTurnLimitForModeFromEnv("max", {
        COACH_DAILY_TURN_LIMIT_MAX: "4",
      })
    ).toBe(4)
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

describe("PORT-derived local defaults", () => {
  it("derives the web origin and auth URL from PORT when unset", () => {
    expect(webOriginsFromEnv({ PORT: "4402" })).toEqual([
      "http://localhost:5402",
    ])
    expect(authUrlFromEnv({ PORT: "4402" })).toBe("http://localhost:4402")
    expect(apiPortFromEnv({ PORT: "4402" })).toBe(4402)
  })

  it("lets explicit WEB_ORIGINS and AUTH_URL win over PORT", () => {
    expect(
      webOriginsFromEnv({ PORT: "4402", WEB_ORIGINS: "https://opencv.me" })
    ).toEqual(["https://opencv.me"])
    expect(
      authUrlFromEnv({ PORT: "4402", AUTH_URL: "https://api.opencv.me" })
    ).toBe("https://api.opencv.me")
  })

  it("keeps 3001 and 5173 when PORT is unset or invalid", () => {
    expect(apiPortFromEnv({})).toBe(3001)
    expect(apiPortFromEnv({ PORT: "nope" })).toBe(3001)
    expect(webOriginsFromEnv({ PORT: "" })).toEqual(["http://localhost:5173"])
  })
})
