import { describe, expect, it } from "vitest"

import { app } from "./app.js"

describe("GET /health", () => {
  it("returns success", async () => {
    const res = await app.request("/health")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })
})
