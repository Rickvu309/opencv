import { afterEach, describe, expect, it, vi } from "vitest"

import { ApiError, apiFetch } from "./api.ts"
import {
  BUSY_WAIT_DEFAULT_MS,
  BUSY_WAIT_MAX_MS,
  BUSY_WAIT_MIN_MS,
  busyServerWaitMs,
  retryAfterMs,
} from "./retry-after.ts"

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

  it("waits the default time when a busy server gives no Retry-After", async () => {
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
    expect((error as ApiError).retryAfterMs).toBe(BUSY_WAIT_DEFAULT_MS)
  })

  it.each([400, 409, 500])(
    "leaves the wait unset on a %i error even with Retry-After",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { ok: false, error: { code: "NO", message: "No." } },
              { status, headers: { "Retry-After": "7" } }
            )
          )
      )
      const error = await apiFetch("/api/commands/paper.canvas").catch(
        (err: unknown) => err
      )
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).retryAfterMs).toBeUndefined()
    }
  )
})

describe("busyServerWaitMs", () => {
  it.each([429, 503])("honours the seconds a %i reply asks for", (status) => {
    expect(busyServerWaitMs(status, "5", NOW)).toBe(5000)
  })

  it("honours an HTTP date", () => {
    expect(busyServerWaitMs(429, "Thu, 12 Nov 2026 10:00:30 GMT", NOW)).toBe(
      30000
    )
  })

  it("caps a huge wait at one minute", () => {
    expect(BUSY_WAIT_MAX_MS).toBe(60_000)
    expect(busyServerWaitMs(503, "86400", NOW)).toBe(BUSY_WAIT_MAX_MS)
    expect(busyServerWaitMs(503, "Fri, 12 Nov 2027 10:00:00 GMT", NOW)).toBe(
      BUSY_WAIT_MAX_MS
    )
    expect(busyServerWaitMs(503, "9".repeat(400), NOW)).toBe(BUSY_WAIT_MAX_MS)
  })

  it("waits at least one second when the server says now or a past date", () => {
    expect(busyServerWaitMs(429, "0", NOW)).toBe(BUSY_WAIT_MIN_MS)
    expect(busyServerWaitMs(429, "Thu, 12 Nov 2026 09:59:00 GMT", NOW)).toBe(
      BUSY_WAIT_MIN_MS
    )
  })

  it("waits the default time when the header is missing or unreadable", () => {
    expect(busyServerWaitMs(503, null, NOW)).toBe(BUSY_WAIT_DEFAULT_MS)
    expect(busyServerWaitMs(503, "soon", NOW)).toBe(BUSY_WAIT_DEFAULT_MS)
  })

  it.each([200, 400, 409, 500, 502])(
    "gives no wait for a %i reply",
    (status) => {
      expect(busyServerWaitMs(status, "5", NOW)).toBeUndefined()
    }
  )
})
