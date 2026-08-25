import { describe, expect, it } from "vitest"

import { databaseUrlFromEnv, webOriginsFromEnv } from "./config.js"

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
