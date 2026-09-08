import { describe, expect, it } from "vitest"

import { APPLY_OPEN_GUIDE, validateApplySearch } from "./apply-search.ts"

describe("Apply search", () => {
  it("keeps the guided first-action deep-link and drops unknown opens", () => {
    expect(APPLY_OPEN_GUIDE).toBe("guide")
    expect(validateApplySearch({ open: APPLY_OPEN_GUIDE })).toEqual({
      open: "guide",
    })
    expect(validateApplySearch({ open: "sample" })).toEqual({})
    expect(validateApplySearch({ open: "tour" })).toEqual({})
    expect(validateApplySearch({})).toEqual({})
  })
})
