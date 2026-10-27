import { describe, expect, it } from "vitest"

import { documentTarget, resolveWebOrigins, shareUrl } from "./web-origins.ts"

const origins = resolveWebOrigins({
  publicOrigin: "https://opencv.me",
  appOrigin: "https://app.opencv.me",
})

describe("web destinations", () => {
  it("keeps today's routing when both origins are unset", () => {
    const single = resolveWebOrigins({})
    expect(documentTarget(new URL("https://opencv.me/app"), single)).toBeNull()
    expect(shareUrl("token", "http://localhost:5450", single)).toBe(
      "http://localhost:5450/share/token"
    )
  })

  it.each([
    { publicOrigin: "https://opencv.me" },
    { publicOrigin: "https://opencv.me", appOrigin: "https://opencv.me/" },
    { publicOrigin: "https://opencv.me", appOrigin: "http://opencv.me:5450" },
    { publicOrigin: "https://opencv.me", appOrigin: "https://www.opencv.me" },
    {
      publicOrigin: "https://opencv.me/path",
      appOrigin: "https://app.opencv.me",
    },
    {
      publicOrigin: "https://opencv.me",
      appOrigin: "https://user:pass@app.opencv.me",
    },
    {
      publicOrigin: "https://opencv.me",
      appOrigin: "https://app.opencv.me?bad=1",
    },
    {
      publicOrigin: "https://opencv.me",
      appOrigin: "https://app.opencv.me#bad",
    },
    { publicOrigin: "https://opencv.me", appOrigin: "file:///app" },
    { publicOrigin: "https://opencv.me", appOrigin: "invalid" },
  ])("rejects ambiguous or invalid configuration: %j", (input) => {
    expect(() => resolveWebOrigins(input)).toThrow()
  })

  it.each([
    [
      "https://opencv.me/sign-in?redirect=%2Fapp%2Fpaper#code",
      "https://app.opencv.me/sign-in?redirect=%2Fapp%2Fpaper#code",
    ],
    [
      "https://www.opencv.me/app/paper?doc=a%2Fb#page",
      "https://app.opencv.me/app/paper?doc=a%2Fb#page",
    ],
    ["https://opencv.me/sign-up", "https://app.opencv.me/sign-up"],
    ["https://app.opencv.me/", "https://app.opencv.me/app"],
    [
      "https://app.opencv.me/?utm=a%2Fb#start",
      "https://app.opencv.me/app?utm=a%2Fb#start",
    ],
    ["https://app.opencv.me/pricing", "https://opencv.me/pricing"],
    [
      "https://app.opencv.me/share/token?x=1#page",
      "https://opencv.me/share/token?x=1#page",
    ],
    ["https://app.opencv.me/u/future", "https://opencv.me/u/future"],
    ["https://opencv.me/", null],
    ["https://www.opencv.me/pricing", null],
    ["https://app.opencv.me/app/paper", null],
    ["https://opencv.me/application", null],
    ["https://app.opencv.me/unknown", null],
    ["https://app.opencv.me/assets/index.js", null],
    ["https://app.opencv.me/health", null],
    ["https://preview.example/app", null],
  ])("routes %s to %s", (href, target) => {
    expect(documentTarget(new URL(href), origins)).toBe(target)
  })

  it("copies public share links from the editor origin", () => {
    expect(shareUrl("a/b?c", "https://app.opencv.me", origins)).toBe(
      "https://opencv.me/share/a%2Fb%3Fc"
    )
  })
})
