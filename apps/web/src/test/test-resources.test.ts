import { afterEach, expect, it, vi } from "vitest"

import { registerTestCleanup } from "./test-resources.ts"

let cleaned = false

afterEach(() => {
  expect(cleaned).toBe(true)
  vi.unstubAllGlobals()
})

it("awaits setup resource cleanup before file hooks restore globals", () => {
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  registerTestCleanup(async () => {
    await Promise.resolve()
    expect(globalThis.fetch).toBe(fetch)
    cleaned = true
  })
})
