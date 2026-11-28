import { describe, expect, it } from "vitest"

import { createApp } from "./app.js"

describe("GET /health", () => {
  it("returns success", async () => {
    const res = await createApp({ webOrigins: [] }).request("/health")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      sha: null,
      pdfReading: true,
    })
  })

  it("names the commit it serves", async () => {
    const res = await createApp({
      webOrigins: [],
      commitSha: "90a4a1cb",
    }).request("/health")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      sha: "90a4a1cb",
      pdfReading: true,
    })
  })

  it("serves 200 when constructed with no database, even if DATABASE_URL is set", async () => {
    const previous = process.env.DATABASE_URL
    process.env.DATABASE_URL = "postgresql://example.invalid/opencv"

    try {
      const res = await createApp({ webOrigins: [] }).request("/health")
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        ok: true,
        sha: null,
        pdfReading: true,
      })
    } finally {
      if (previous === undefined) {
        delete process.env.DATABASE_URL
      } else {
        process.env.DATABASE_URL = previous
      }
    }
  })

  it("never reads env when ANTHROPIC_API_KEY is set on the process", async () => {
    const previous = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    }
    process.env.ANTHROPIC_API_KEY = "fixture-should-not-be-read"

    try {
      const res = await createApp({ webOrigins: [] }).request("/health")
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        ok: true,
        sha: null,
        pdfReading: true,
      })
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
    }
  })
})

describe("request body limit", () => {
  it("returns the API 413 envelope when a request body exceeds 9 MB", async () => {
    const body = new Uint8Array(9_000_001)
    const res = await createApp({ webOrigins: [] }).request("/health", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body,
    })

    expect(res.status).toBe(413)
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Request body is too large" },
    })
  })
})

describe("CORS", () => {
  it("lets the browser send credentials and read a download's file name", async () => {
    const api = createApp({ webOrigins: ["https://opencv.me"] })
    const path =
      "/api/paper/00000000-0000-4000-8000-000000000001/native-word?kind=cv"
    const preflight = await api.request(path, {
      method: "OPTIONS",
      headers: {
        Origin: "https://opencv.me",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get("access-control-allow-credentials")).toBe(
      "true"
    )
    const allowed = preflight.headers
      .get("access-control-allow-headers")
      ?.toLowerCase()
      .split(",")
    expect(allowed).toEqual(expect.arrayContaining(["content-type"]))
    const response = await api.request(path, {
      headers: { Origin: "https://opencv.me" },
    })
    const exposed = response.headers
      .get("access-control-expose-headers")
      ?.toLowerCase()
      .split(",")
    expect(exposed).toEqual(expect.arrayContaining(["content-disposition"]))
  })

  it("lets the configured web origin read the health response", async () => {
    const api = createApp({ webOrigins: ["https://opencv.me"] })

    const res = await api.request("/health", {
      headers: { Origin: "https://opencv.me" },
    })

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://opencv.me"
    )
  })

  it("does not let an unlisted origin read the health response", async () => {
    const api = createApp({ webOrigins: ["https://opencv.me"] })

    const res = await api.request("/health", {
      headers: { Origin: "https://attacker.example.com" },
    })

    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("lets a Vercel preview origin matching the configured pattern read the health response", async () => {
    const api = createApp({
      webOrigins: ["https://opencv-*-example.vercel.app"],
    })

    const res = await api.request("/health", {
      headers: {
        Origin: "https://opencv-git-feat-qve-85-example.vercel.app",
      },
    })

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://opencv-git-feat-qve-85-example.vercel.app"
    )
  })

  it("does not let a lookalike host slip through the preview pattern", async () => {
    const api = createApp({
      webOrigins: ["https://opencv-*-example.vercel.app"],
    })

    for (const origin of [
      "https://opencv-build-example.vercel.app.attacker.example.com",
      "https://opencv-build.attacker-example.vercel.app",
      "https://opencv--example.vercel.app",
    ]) {
      const res = await api.request("/health", { headers: { Origin: origin } })
      expect(res.headers.get("access-control-allow-origin")).toBeNull()
    }
  })

  it("answers the browser preflight for a configured origin", async () => {
    const api = createApp({ webOrigins: ["https://opencv.me"] })

    const res = await api.request("/health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://opencv.me",
        "Access-Control-Request-Method": "GET",
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://opencv.me"
    )
    expect(res.headers.get("access-control-allow-credentials")).toBe("true")
  })

  it("echoes credentials on an allowed origin and still refuses an unlisted one", async () => {
    const api = createApp({ webOrigins: ["https://opencv.me"] })

    const allowed = await api.request("/health", {
      headers: { Origin: "https://opencv.me" },
    })
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://opencv.me"
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

    const command = await api.request("/api/commands/chat.create", {
      method: "POST",
      body: "{}",
    })
    expect(command.status).toBe(503)
    await expect(command.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Authentication is not configured",
      },
    })

    const list = await api.request("/api/reads/chat.list", {
      method: "POST",
      body: "{}",
    })
    expect(list.status).toBe(503)

    const paper = await api.request("/api/reads/paper.list", {
      method: "POST",
      body: "{}",
    })
    expect(paper.status).toBe(503)

    const jobs = await api.request("/api/reads/job.list", {
      method: "POST",
      body: "{}",
    })
    expect(jobs.status).toBe(503)

    const missing = await api.request("/api/missing")
    expect(missing.status).toBe(404)
  })
})
