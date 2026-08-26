import { describe, expect, it } from "vitest"

import { paperCoachThreadStorageKey } from "./use-paper-coach.ts"

describe("Paper Coach thread key", () => {
  it("scopes the Paper Thread to the open document", () => {
    expect(
      paperCoachThreadStorageKey("11111111-1111-7111-8111-111111111111")
    ).toBe("openpath:paper-coach-thread:11111111-1111-7111-8111-111111111111")
  })
})
