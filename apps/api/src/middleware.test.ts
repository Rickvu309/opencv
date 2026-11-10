import { ERROR_CODES } from "@workspace/domain"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import type { Auth } from "./auth.js"
import type { AppDatabase } from "./db/context.js"
import { PaperPackageRefusal } from "./paper/package-errors.js"
import { CommandError } from "./registry/errors.js"
import {
  handleApiError,
  notFoundEnvelopeResponse,
  requireSession,
  type SessionVariables,
} from "./middleware.js"

const db = {} as AppDatabase

function authWith(session: unknown) {
  return {
    api: { getSession: vi.fn().mockResolvedValue(session) },
  } as unknown as Auth
}

function guardedApp(auth: Auth | undefined, database: AppDatabase | undefined) {
  const app = new Hono<{ Variables: SessionVariables }>()
  app.get("/me", requireSession(auth, database), (c) =>
    c.json({ userId: c.var.userId })
  )
  return app
}

describe("requireSession", () => {
  it("returns 503 without auth or db", async () => {
    for (const app of [
      guardedApp(undefined, db),
      guardedApp(authWith(null), undefined),
    ]) {
      const res = await app.request("/me")
      expect(res.status).toBe(503)
      await expect(res.json()).resolves.toEqual({
        ok: false,
        error: {
          code: ERROR_CODES.AUTH_UNAVAILABLE,
          message: "Authentication is not configured",
        },
      })
    }
  })

  it("returns 401 without a session", async () => {
    const res = await guardedApp(authWith(null), db).request("/me")
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required",
      },
    })
  })

  it("sets userId and calls next with a session", async () => {
    const res = await guardedApp(
      authWith({ user: { id: "user-1" }, session: {} }),
      db
    ).request("/me")
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ userId: "user-1" })
  })
})

describe("api error handling", () => {
  function errorApp(thrown: unknown) {
    const app = new Hono()
    app.onError(handleApiError)
    app.notFound(notFoundEnvelopeResponse)
    app.get("/boom", () => {
      throw thrown
    })
    return app
  }

  it("onError maps CommandError to its status and code", async () => {
    const res = await errorApp(
      new CommandError(ERROR_CODES.FORBIDDEN, "Not yours")
    ).request("/boom")
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.FORBIDDEN, message: "Not yours" },
    })
  })

  it("onError returns a package refusal as its reason, not a server error", async () => {
    const res = await errorApp(
      new PaperPackageRefusal("BEFORE_TEXT_MISMATCH")
    ).request("/boom")
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "BEFORE_TEXT_MISMATCH",
        message:
          "BEFORE_TEXT_MISMATCH: The text to replace does not exactly match this span. Read it again and use its exact text.",
      },
    })
  })

  it("onError turns an unknown throw into a 500 envelope", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const res = await errorApp(new Error("boom")).request("/boom")
      expect(res.status).toBe(500)
      expect(res.headers.get("content-type")).toContain("application/json")
      const text = await res.text()
      expect(text).not.toContain("boom")
      expect(JSON.parse(text)).toEqual({
        ok: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: "Something went wrong",
        },
      })
      expect(log).toHaveBeenCalledTimes(1)
    } finally {
      log.mockRestore()
    }
  })

  it("notFound returns a 404 envelope", async () => {
    const res = await errorApp(new Error("unused")).request("/nope")
    expect(res.status).toBe(404)
    expect(res.headers.get("content-type")).toContain("application/json")
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: "Not found" },
    })
  })
})
