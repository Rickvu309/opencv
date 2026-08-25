import { describe, expect, it } from "vitest"

import {
  authUrlFromEnv,
  databaseUrlFromEnv,
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
    expect(sessionSecretFromEnv({ SESSION_SECRET: "  super-secret-value  " })).toBe(
      "super-secret-value"
    )
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
