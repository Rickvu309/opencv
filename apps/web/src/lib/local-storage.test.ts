import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { readStored, writeStored } from "./local-storage.ts"

const KEY = "opencv:test:key"

function parseMode(raw: string | null): "a" | "b" | null {
  return raw === "a" || raw === "b" ? raw : null
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("readStored", () => {
  it("returns the parsed value for a valid stored string", () => {
    localStorage.setItem(KEY, "b")

    expect(readStored(KEY, parseMode, null)).toBe("b")
  })

  it("passes null to parse when the key is missing", () => {
    const parse = vi.fn(parseMode)

    expect(readStored(KEY, parse, "a")).toBe(null)
    expect(parse).toHaveBeenCalledWith(null)
  })

  it("returns the fallback when parse rejects the stored value", () => {
    localStorage.setItem(KEY, "junk")
    const parse = (raw: string | null) => {
      if (raw !== "a" && raw !== "b") throw new Error("invalid")
      return raw
    }

    expect(readStored(KEY, parse, "a")).toBe("a")
  })

  it("returns the fallback when getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })

    expect(readStored(KEY, parseMode, "a")).toBe("a")
  })
})

describe("writeStored", () => {
  it("stores the value under the key", () => {
    writeStored(KEY, "a")

    expect(localStorage.getItem(KEY)).toBe("a")
  })

  it("does not throw when setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError")
    })

    expect(() => writeStored(KEY, "a")).not.toThrow()
  })
})
