import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import { installRawLimitCheck, rawLimitProblem } from "./raw-limit.js"

describe("a 429 or 503 without a catalog id", () => {
  it("fires on a mistake route and stays quiet on a catalog refusal", async () => {
    const app = new Hono()
    app.get("/mistake", () => new Response("no", { status: 429 }))
    app.get(
      "/clean",
      () =>
        new Response("no", {
          status: 429,
          headers: { "x-limit": "export.running" },
        })
    )
    app.get("/old-auth", () => new Response("no", { status: 429 }))
    installRawLimitCheck(app)
    await expect(app.request("/mistake")).rejects.toThrow(/x-limit/)
    const clean = await app.request("/clean")
    expect(clean.status).toBe(429)
    const old = await app.request("/api/auth/email-otp/send-verification-otp")
    expect(old.status).toBe(404)
    expect(
      rawLimitProblem(429, "/api/auth/email-otp/send-verification-otp", null)
    ).toBeNull()
    expect(rawLimitProblem(503, "/api/paper/import", null)).toBeNull()
    expect(rawLimitProblem(429, "/api/coach/tasks", null)).toBeNull()
    expect(rawLimitProblem(503, "/health/deep", null)).toBeNull()
    expect(rawLimitProblem(429, "/api/account/export", null)).toMatch(/export/)
    expect(
      rawLimitProblem(429, "/api/account/export", "export.running")
    ).toBeNull()
    expect(rawLimitProblem(200, "/api/account/export", null)).toBeNull()
  })
})
