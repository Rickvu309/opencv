import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError, apiFetch } from "./api.ts"
import { retryAfterMs } from "./retry-after.ts"

const NOW = Date.parse("2026-11-12T10:00:00Z")

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("retryAfterMs", () => {
  it("reads a number of seconds", () => {
    expect(retryAfterMs("5", NOW)).toBe(5000)
    expect(retryAfterMs(" 0 ", NOW)).toBe(0)
  })

  it("reads an HTTP date as the time left until it", () => {
    expect(retryAfterMs("Thu, 12 Nov 2026 10:00:30 GMT", NOW)).toBe(30000)
    expect(retryAfterMs("Thu, 12 Nov 2026 09:59:00 GMT", NOW)).toBe(0)
  })

  it("ignores a missing or unreadable value", () => {
    expect(retryAfterMs(null, NOW)).toBeNull()
    expect(retryAfterMs("", NOW)).toBeNull()
    expect(retryAfterMs("-3", NOW)).toBeNull()
    expect(retryAfterMs("1.5", NOW)).toBeNull()
    expect(retryAfterMs("soon", NOW)).toBeNull()
  })
})

describe("apiFetch with Retry-After", () => {
  it.each([429, 503])(
    "carries the server's wait on the %i error",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { ok: false, error: { code: "BUSY", message: "Busy." } },
              { status, headers: { "Retry-After": "7" } }
            )
          )
      )
      const error = await apiFetch("/api/commands/paper.canvas").catch(
        (err: unknown) => err
      )
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ status, retryAfterMs: 7000 })
    }
  )

  it("leaves the wait unset when the server gives none", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { ok: false, error: { code: "BUSY", message: "Busy." } },
            { status: 503 }
          )
        )
    )
    const error = await apiFetch("/api/commands/paper.canvas").catch(
      (err: unknown) => err
    )
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).retryAfterMs).toBeUndefined()
  })
})
