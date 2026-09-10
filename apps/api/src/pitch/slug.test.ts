import { isPitchPublicSlug, pitchHandle } from "@workspace/domain"
import { describe, expect, it } from "vitest"

describe("pitch public slug", () => {
  it("matches the handle Copy link puts on /u/:slug", () => {
    expect(pitchHandle("Alex Tran")).toBe("alex-tran")
    expect(pitchHandle("Minh")).toBe("minh")
    expect(isPitchPublicSlug("alex-tran")).toBe(true)
    expect(isPitchPublicSlug("Minh")).toBe(false)
    expect(isPitchPublicSlug("../admin")).toBe(false)
  })
})
