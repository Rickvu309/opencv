import { afterEach, describe, expect, it, vi } from "vitest"

import { apiBaseUrl, fetchHealth } from "./api.ts"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchHealth", () => {
  it("calls GET /health on the configured API host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchHealth()).resolves.toEqual({ ok: true })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${apiBaseUrl}/health`)
  })

  it("rejects when the health endpoint is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    )

    await expect(fetchHealth()).rejects.toThrow("Failed to fetch")
  })

  it("rejects when health responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 502 }))
    )

    await expect(fetchHealth()).rejects.toThrow("Health check failed with 502")
  })
})
