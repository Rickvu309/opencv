import { describe, expect, it } from "vitest"

import { resolveProfileImageSrc } from "@/lib/requests.ts"

describe("resolveProfileImageSrc", () => {
  it("resolves persisted file IDs through the authenticated bytes route", () => {
    expect(
      resolveProfileImageSrc("68800000-0000-4000-8000-000000000001")
    ).toContain("/api/paper/files/68800000-0000-4000-8000-000000000001/bytes")
  })

  it("preserves external image URLs and rejects unsupported values", () => {
    expect(resolveProfileImageSrc("https://images.example/photo.png")).toBe(
      "https://images.example/photo.png"
    )
    expect(resolveProfileImageSrc("not-a-file-id")).toBeUndefined()
    expect(resolveProfileImageSrc(null)).toBeUndefined()
  })
})
