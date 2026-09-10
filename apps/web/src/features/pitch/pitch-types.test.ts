import { describe, expect, it } from "vitest"

import {
  isPitchPublicSlug,
  pitchHandle,
  publicPitchHref,
  publicPitchLabel,
  publicPitchPath,
} from "@/features/pitch/pitch-types.ts"

describe("public Pitch slug", () => {
  it("slugifies a User name into the public handle", () => {
    expect(pitchHandle("Alex Tran")).toBe("alex-tran")
    expect(pitchHandle("  Minh  Quân  ")).toBe("minh-qu-n")
    expect(isPitchPublicSlug("alex-tran")).toBe(true)
    expect(isPitchPublicSlug("Alex-Tran")).toBe(false)
    expect(isPitchPublicSlug("")).toBe(false)
  })

  it("builds a same-origin public URL for Copy link", () => {
    expect(publicPitchPath("alex-tran")).toBe("/u/alex-tran")
    expect(publicPitchLabel("alex-tran")).toBe("openpath.app/u/alex-tran")
    expect(publicPitchHref("alex-tran")).toBe(
      `${window.location.origin}/u/alex-tran`
    )
  })
})
