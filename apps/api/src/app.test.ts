import { THREAD_COMMANDS } from "@workspace/domain"
import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"

describe("GET /health", () => {
  it("returns success", async () => {
    const res = await createApp({ webOrigins: [] }).request("/health")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it("serves 200 when constructed with no database, even if DATABASE_URL is set", async () => {
    const previous = process.env.DATABASE_URL
    process.env.DATABASE_URL = "postgresql://example.invalid/openpath"

    try {
      const res = await createApp({ webOrigins: [] }).request("/health")
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ ok: true })
    } finally {
      if (previous === undefined) {
        delete process.env.DATABASE_URL
      } else {
        process.env.DATABASE_URL = previous
      }
    }
  })
})

describe("CORS", () => {
  it("lets the configured web origin read the health response", async () => {
    const api = createApp({ webOrigins: ["https://openpath-app.vercel.app"] })

    const res = await api.request("/health", {
      headers: { Origin: "https://openpath-app.vercel.app" },
    })

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://openpath-app.vercel.app"
    )
  })

  it("does not let an unlisted origin read the health response", async () => {
    const api = createApp({ webOrigins: ["https://openpath-app.vercel.app"] })

    const res = await api.request("/health", {
      headers: { Origin: "https://attacker.example.com" },
    })

    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("lets a Vercel preview origin matching the configured pattern read the health response", async () => {
    const api = createApp({
      webOrigins: ["https://openpath-*-rickvudev.vercel.app"],
    })

    const res = await api.request("/health", {
      headers: {
        Origin: "https://openpath-git-feat-qve-85-rickvudev.vercel.app",
      },
    })

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://openpath-git-feat-qve-85-rickvudev.vercel.app"
    )
  })

  it("does not let a lookalike host slip through the preview pattern", async () => {
    const api = createApp({
      webOrigins: ["https://openpath-*-rickvudev.vercel.app"],
    })

    for (const origin of [
      "https://openpath-build-rickvudev.vercel.app.attacker.example.com",
      "https://openpath-build.attacker-rickvudev.vercel.app",
      "https://openpath--rickvudev.vercel.app",
    ]) {
      const res = await api.request("/health", { headers: { Origin: origin } })
      expect(res.headers.get("access-control-allow-origin")).toBeNull()
    }
  })

  it("answers the browser preflight for a configured origin", async () => {
    const api = createApp({ webOrigins: ["https://openpath-app.vercel.app"] })

    const res = await api.request("/health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://openpath-app.vercel.app",
        "Access-Control-Request-Method": "GET",
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://openpath-app.vercel.app"
    )
    expect(res.headers.get("access-control-allow-credentials")).toBe("true")
  })

  it("echoes credentials on an allowed origin and still refuses an unlisted one", async () => {
    const api = createApp({ webOrigins: ["https://openpath-app.vercel.app"] })

    const allowed = await api.request("/health", {
      headers: { Origin: "https://openpath-app.vercel.app" },
    })
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://openpath-app.vercel.app"
    )
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true")

    const refused = await api.request("/health", {
      headers: { Origin: "https://attacker.example.com" },
    })
    expect(refused.headers.get("access-control-allow-origin")).toBeNull()
  })
})

describe("commands without auth", () => {
  it("returns AUTH_UNAVAILABLE when the app has no database", async () => {
    const api = createApp({ webOrigins: [] })

    const command = await api.request(
      `/api/commands/${THREAD_COMMANDS.create}`,
      {
        method: "POST",
        body: "{}",
      }
    )
    expect(command.status).toBe(503)
    await expect(command.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Authentication is not configured",
      },
    })

    const list = await api.request("/api/threads")
    expect(list.status).toBe(503)

    const paper = await api.request("/api/paper")
    expect(paper.status).toBe(503)
  })
})
