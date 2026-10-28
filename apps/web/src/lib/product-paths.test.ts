import { describe, expect, it } from "vitest"

import { legacyAppPath, legacyPathname } from "./product-paths.ts"

describe("legacy product paths", () => {
  it("strips only the app segment and keeps query and hash", () => {
    expect(legacyPathname("/app")).toBe("/")
    expect(legacyPathname("/app/")).toBe("/")
    expect(legacyPathname("/app/coach")).toBe("/coach")
    expect(legacyPathname("/app//example.com")).toBe("/example.com")
    expect(legacyPathname("/app/paper/doc")).toBe("/paper/doc")
    expect(legacyPathname("/apply")).toBeUndefined()
    expect(legacyPathname("/application")).toBeUndefined()
    expect(legacyPathname("/pricing")).toBeUndefined()
    expect(legacyPathname("/coach")).toBeUndefined()

    expect(legacyAppPath("/app/paper?doc=a%2Fb#page")).toBe(
      "/paper?doc=a%2Fb#page"
    )
    expect(legacyAppPath("/app?utm=a%2Fb#start")).toBe("/?utm=a%2Fb#start")
    expect(legacyAppPath("/apply")).toBeUndefined()
    expect(legacyAppPath("/application")).toBeUndefined()
    expect(legacyAppPath("/coach")).toBeUndefined()
  })
})
