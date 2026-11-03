import { describe, expect, it } from "vitest"

import {
  DEFAULT_CAFE_PROOF,
  DEFAULT_CAMPUS_PROOF,
  DEFAULT_CHECKOUT_PROOF,
  DEFAULT_ONBOARDING_PROOF,
} from "./paper-proof-types.ts"

describe("retired proof names", () => {
  it("keeps the cafe name as the checkout proof", () => {
    expect(DEFAULT_CAFE_PROOF).toBe(DEFAULT_CHECKOUT_PROOF)
  })

  it("keeps the campus name as the onboarding proof", () => {
    expect(DEFAULT_CAMPUS_PROOF).toBe(DEFAULT_ONBOARDING_PROOF)
  })
})
