import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import type { AppDatabase } from "./db/context.js"
import { createMigratedTestDb } from "./test/harness.js"

const mail = { resendApiKey: "re_secret_key", authEmailFrom: "hi@opencv.me" }

describe("GET /health/deep", () => {
  it("reports mail:false and 503 when sign-in mail is not configured (incident I4)", async () => {
    const { db } = await createMigratedTestDb()
    const app = createApp({
      webOrigins: [],
      db: db as unknown as AppDatabase,
      logAuthMail: false,
      commitSha: "abc1234",
    })

    const deep = await app.request("/health/deep")
    expect(deep.status).toBe(503)
    await expect(deep.json()).resolves.toEqual({
      ok: false,
      sha: "abc1234",
      db: true,
      mail: false,
      schemaVersion: "0003_paper_favorites",
    })

    const shallow = await app.request("/health")
    expect(shallow.status).toBe(200)
  })

  it("answers 200 with the sha and schema version when everything is configured", async () => {
    const { db } = await createMigratedTestDb()
    const res = await createApp({
      webOrigins: [],
      db: db as unknown as AppDatabase,
      logAuthMail: false,
      commitSha: "abc1234",
      ...mail,
    }).request("/health/deep")

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      ok: true,
      sha: "abc1234",
      db: true,
      mail: true,
      schemaVersion: "0003_paper_favorites",
    })
    expect(text).not.toContain(mail.resendApiKey)
    expect(text).not.toContain(mail.authEmailFrom)
  })

  it("reports db:false without hanging when the database never answers", async () => {
    const hung = { execute: () => new Promise(() => {}) }
    const started = Date.now()
    const res = await createApp({
      webOrigins: [],
      db: hung as never,
      healthDbTimeoutMs: 50,
      ...mail,
    }).request("/health/deep")

    expect(Date.now() - started).toBeLessThan(1000)
    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({ db: false, mail: true })
  })

  it("reports db:false without error text when the database rejects", async () => {
    const broken = {
      execute: () =>
        Promise.reject(new Error("password authentication failed")),
    }
    const res = await createApp({
      webOrigins: [],
      db: broken as never,
      ...mail,
    }).request("/health/deep")

    expect(res.status).toBe(503)
    const text = await res.text()
    expect(JSON.parse(text)).toMatchObject({ db: false, schemaVersion: null })
    expect(text).not.toContain("password")
  })

  it("reports db:false when no database is configured, and /health still serves 200", async () => {
    const app = createApp({ webOrigins: [], ...mail })
    expect((await app.request("/health/deep")).status).toBe(503)
    expect((await app.request("/health")).status).toBe(200)
  })
})
