import { afterEach, expect, it, vi } from "vitest"

import { cleanupTestResources, registerTestCleanup } from "./test-resources.ts"

let cleaned = true

afterEach(() => {
  expect(cleaned).toBe(true)
  vi.unstubAllGlobals()
})

it("awaits setup resource cleanup before file hooks restore globals", () => {
  cleaned = false
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  registerTestCleanup(async () => {
    await Promise.resolve()
    expect(globalThis.fetch).toBe(fetch)
    cleaned = true
  })
})

it("runs every cleanup after a failure and retries only unfinished callbacks", async () => {
  const failure = new Error("cleanup rejected")
  const failing = vi
    .fn<() => Promise<void>>()
    .mockRejectedValueOnce(failure)
    .mockResolvedValue(undefined)
  const other = vi.fn(async () => {})
  registerTestCleanup(failing)
  registerTestCleanup(other)
  try {
    await expect(cleanupTestResources()).rejects.toMatchObject({
      name: "AggregateError",
      message: "Test resource cleanup failed: Error: cleanup rejected",
      errors: [failure],
    })
    expect(other).toHaveBeenCalledTimes(1)
  } finally {
    await cleanupTestResources()
  }
  expect(failing).toHaveBeenCalledTimes(2)
  expect(other).toHaveBeenCalledTimes(1)
})
