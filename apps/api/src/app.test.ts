import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"

describe("GET /health", () => {
  it("returns success", async () => {
    const res = await createApp({ webOrigins: [] }).request("/health")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })
})

describe("CORS", () => {
  it("lets the configured web origin read the health response", async () => {
    const api = createApp({ webOrigins: ["https://openpath-lovat.vercel.app"] })

    const res = await api.request("/health", {
      headers: { Origin: "https://openpath-lovat.vercel.app" },
    })

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://openpath-lovat.vercel.app"
    )
  })

  it("does not let an unlisted origin read the health response", async () => {
    const api = createApp({ webOrigins: ["https://openpath-lovat.vercel.app"] })

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
    const api = createApp({ webOrigins: ["https://openpath-lovat.vercel.app"] })

    const res = await api.request("/health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://openpath-lovat.vercel.app",
        "Access-Control-Request-Method": "GET",
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://openpath-lovat.vercel.app"
    )
  })
})
