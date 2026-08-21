import { describe, expect, it } from "vitest"

import { webOriginsFromEnv } from "./config.js"

describe("webOriginsFromEnv", () => {
  it("reads a comma-separated WEB_ORIGINS list, ignoring blanks and padding", () => {
    expect(
      webOriginsFromEnv({
        WEB_ORIGINS:
          " https://openpath-lovat.vercel.app , https://openpath-*-rickvudev.vercel.app ,, ",
      })
    ).toEqual([
      "https://openpath-lovat.vercel.app",
      "https://openpath-*-rickvudev.vercel.app",
    ])
  })

  it("falls back to the local web dev server when WEB_ORIGINS is unset", () => {
    expect(webOriginsFromEnv({})).toEqual(["http://localhost:5173"])
  })
})
