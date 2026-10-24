import { describe, expect, it } from "vitest"
import { appHref, publicHref, siteRedirect } from "./site-url.ts"

describe("public and app hosts", () => {
  it.each(["https://opencv.me", "https://www.opencv.me"])(
    "sends public calls to action to the app from %s",
    (origin) => {
      expect(appHref("/sign-up", origin)).toBe("https://app.opencv.me/sign-up")
      expect(siteRedirect("/app/paper?doc=cv-1#experience", origin)).toBe(
        "https://app.opencv.me/app/paper?doc=cv-1#experience"
      )
      expect(siteRedirect("/sign-in?redirect=%2Fapp%2Fapply", origin)).toBe(
        "https://app.opencv.me/sign-in?redirect=%2Fapp%2Fapply"
      )
      expect(siteRedirect("/", origin)).toBeUndefined()
      expect(siteRedirect("/u/alex", origin)).toBeUndefined()
      expect(siteRedirect("/application", origin)).toBeUndefined()
    }
  )

  it("keeps app navigation local and public links on the public host", () => {
    const origin = "https://app.opencv.me"
    expect(appHref("/sign-in", origin)).toBe("/sign-in")
    expect(publicHref("/u/alex", origin)).toBe("https://opencv.me/u/alex")
    expect(siteRedirect("/?welcome=1#hello", origin)).toBe(
      "https://app.opencv.me/app?welcome=1#hello"
    )
    expect(siteRedirect("/u/alex?ref=cv#work", origin)).toBe(
      "https://opencv.me/u/alex?ref=cv#work"
    )
    expect(siteRedirect("/app/apply", origin)).toBeUndefined()
  })

  it("keeps local development on its assigned origin", () => {
    const origin = "http://localhost:4341"
    expect(appHref("/sign-up", origin)).toBe("/sign-up")
    expect(publicHref("/u/alex", origin)).toBe(`${origin}/u/alex`)
    expect(siteRedirect("/app/paper", origin)).toBeUndefined()
  })
})
