import { DEFAULT_COACH_MODEL } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { createApp } from "../app.js"
import { createMigratedTestDb, createTestApp, signUp } from "../test/harness.js"
import { coachRuntimeFromConfig } from "./bind.js"

const user = {
  name: "Minh",
  email: "minh-coach-bind@example.com",
  password: "correct-horse-battery",
}

describe("coachRuntimeFromConfig", () => {
  it("leaves the runtime uninjected when the key is missing", () => {
    expect(coachRuntimeFromConfig({})).toBeUndefined()
    expect(
      coachRuntimeFromConfig({
        openRouterApiKey: "sk-or-test",
      })
    ).toBeUndefined()
  })

  it("prefers the scripted fake when requested", () => {
    const runtime = coachRuntimeFromConfig({ runtimeMode: "fake" })
    expect(runtime).toBeDefined()
    expect(typeof runtime?.streamTurn).toBe("function")
  })

  it("constructs the OpenRouter runtime without calling a model", () => {
    const runtime = coachRuntimeFromConfig({
      openRouterApiKey: "sk-or-test-key",
      coachModel: DEFAULT_COACH_MODEL,
      db: {} as never,
    })
    expect(runtime).toBeDefined()
    expect(typeof runtime?.streamTurn).toBe("function")
  })
})

describe("missing key leaves health untouched", () => {
  it("serves health 200 and coach 503 when no runtime is wired", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const coach = coachRuntimeFromConfig({ db })
      expect(coach).toBeUndefined()

      const app = createTestApp(db)
      const health = await app.request("/health")
      expect(health.status).toBe(200)
      await expect(health.json()).resolves.toEqual({ ok: true })

      const signed = await signUp(app, user)
      const created = await app.request("/api/commands/threads.create", {
        method: "POST",
        headers: {
          Origin: "https://openpath-app.vercel.app",
          Cookie: signed.cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "No key" }),
      })
      const body = (await created.json()) as { data: { id: string } }
      const res = await app.request(`/api/threads/${body.data.id}/coach`, {
        method: "POST",
        headers: {
          Origin: "https://openpath-app.vercel.app",
          Cookie: signed.cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Hello" }),
      })
      expect(res.status).toBe(503)
      await expect(res.json()).resolves.toEqual({
        ok: false,
        error: {
          code: "COACH_UNAVAILABLE",
          message: "The Coach is unavailable right now",
        },
      })

      const bareHealth = await createApp({ webOrigins: [] }).request("/health")
      expect(bareHealth.status).toBe(200)
    } finally {
      await client.close()
    }
  }, 60_000)
})
