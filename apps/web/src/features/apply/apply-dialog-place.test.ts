import { describe, expect, it } from "vitest"

import { contentCenterShift } from "./apply-dialog-place.ts"

describe("new job dialog center", () => {
  it("matches the pen shift when the side menu is open", () => {
    expect(contentCenterShift({ left: 244, width: 1188 }, 1440)).toBe(118)
  })

  it("sits on the page center when the side menu is closed", () => {
    expect(contentCenterShift({ left: 8, width: 1424 }, 1440)).toBe(0)
  })

  it("stays put when the page box has not been measured", () => {
    expect(contentCenterShift({ left: 0, width: 0 }, 1024)).toBe(0)
  })
})
