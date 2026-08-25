import { describe, expect, it } from "vitest"

import { createId } from "./id.js"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("createId", () => {
  it("returns an RFC 9562 UUIDv7", () => {
    expect(createId()).toMatch(UUID_RE)
  })

  it("is time-ordered", () => {
    const earlier = createId(1_700_000_000_000)
    const later = createId(1_700_000_000_100)
    expect(earlier < later).toBe(true)
  })
})
