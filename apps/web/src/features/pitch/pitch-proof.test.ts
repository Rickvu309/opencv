import { describe, expect, it } from "vitest"

import { DEFAULT_CHECKOUT_PROOF } from "@/features/paper/paper-proof-types.ts"

import {
  PITCH_CHECKOUT_PROOF_ID,
  resolveAchievementProof,
} from "./pitch-proof.ts"

describe("resolveAchievementProof", () => {
  it("opens the checkout Proof from proofId", () => {
    expect(
      resolveAchievementProof({
        title: "Anything",
        proofId: PITCH_CHECKOUT_PROOF_ID,
      })
    ).toEqual(DEFAULT_CHECKOUT_PROOF)
  })

  it("falls back to the starter checkout title for persisted Pitch docs", () => {
    expect(
      resolveAchievementProof({
        title: "Checkout card resize study",
        link: "#",
      })
    ).toEqual(DEFAULT_CHECKOUT_PROOF)
  })

  it("treats a dead href as no Proof when the title does not match", () => {
    expect(
      resolveAchievementProof({
        title: "Campus expense app",
        link: "#",
      })
    ).toBeNull()
  })

  it("ignores unknown proof keys", () => {
    expect(
      resolveAchievementProof({
        title: "Campus expense app",
        proofId: "missing",
        link: "https://example.com",
      })
    ).toBeNull()
  })
})
