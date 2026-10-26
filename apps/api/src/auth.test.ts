import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { createApp } from "./app.js"
import { cookieAttributesForAuthUrl } from "./auth.js"
import type { AppDatabase } from "./db/context.js"
import { runMigrations } from "./db/migrate.js"
import * as schema from "./db/schema.js"
import {
  createMigratedTestDb,
  createTestApp,
  signUp,
  testWebOrigin,
} from "./test/harness.js"

const webOrigin = "https://opencv.me"
const sessionSecret = "test-session-secret-that-is-at-least-32ch"

function cookieHeader(res: Response) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ")
}

function sessionSetCookie(res: Response) {
  return (
    res.headers
      .getSetCookie()
      .find((cookie) => cookie.toLowerCase().includes("session_token")) ?? ""
  )
}

function createAuthedApp(db: ReturnType<typeof drizzle>, authUrl: string) {
  return createApp({
    webOrigins: [webOrigin],
    sessionSecret,
    authUrl,
    db,
    rateLimitEnabled: false,
  })
}

describe("cookieAttributesForAuthUrl", () => {
  it("uses SameSite=None; Secure when the auth URL is https", () => {
    expect(cookieAttributesForAuthUrl("https://api.example.com")).toEqual({
      secure: true,
      sameSite: "none",
      httpOnly: true,
    })
  })

  it("uses local defaults when the auth URL is http", () => {
    expect(cookieAttributesForAuthUrl("http://localhost:3001")).toEqual({
      secure: false,
      sameSite: "lax",
      httpOnly: true,
    })
  })
})

describe("auth cookie round-trip", () => {
  let client: PGlite
  let app: ReturnType<typeof createApp>
  let localApp: ReturnType<typeof createApp>

  beforeAll(async () => {
    client = new PGlite()
    const db = drizzle({ client, schema })
    await runMigrations(db as unknown as AppDatabase)
    app = createAuthedApp(db, "https://api.example.com")
    localApp = createAuthedApp(db, "http://localhost:3001")
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  it("signs up, sets a cookie, and reads the authed session", async () => {
    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        Origin: webOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Minh",
        email: "minh@example.com",
        password: "correct-horse-battery",
      }),
    })

    expect(signUp.status).toBe(200)
    expect(sessionSetCookie(signUp)).toMatch(/session_token/i)
    expect(sessionSetCookie(signUp)).toMatch(/samesite=none/i)
    expect(sessionSetCookie(signUp)).toMatch(/secure/i)

    const session = await app.request("/api/session", {
      headers: {
        Origin: webOrigin,
        Cookie: cookieHeader(signUp),
      },
    })

    expect(session.status).toBe(200)
    const body = (await session.json()) as {
      ok: boolean
      user: { email: string; name: string }
      session: { token: string }
    }
    expect(body.ok).toBe(true)
    expect(body.user.email).toBe("minh@example.com")
    expect(body.user.name).toBe("Minh")
    expect(body.session).toEqual(
      expect.objectContaining({ token: expect.any(String) })
    )
  })

  it("returns a 401 envelope on a bare session read", async () => {
    const res = await app.request("/api/session")

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    })
  })

  it("signs in, reads the session, then signs out", async () => {
    const credentials = {
      name: "Lan",
      email: "lan@example.com",
      password: "correct-horse-battery",
    }

    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        Origin: webOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    })
    expect(signUp.status).toBe(200)

    const signOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: webOrigin,
        Cookie: cookieHeader(signUp),
      },
    })
    expect(signOut.status).toBe(200)

    const afterSignOut = await app.request("/api/session", {
      headers: { Cookie: cookieHeader(signOut) },
    })
    expect(afterSignOut.status).toBe(401)

    const signIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        Origin: webOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    })
    expect(signIn.status).toBe(200)

    const session = await app.request("/api/session", {
      headers: { Cookie: cookieHeader(signIn) },
    })
    expect(session.status).toBe(200)
    await expect(session.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        user: expect.objectContaining({ email: credentials.email }),
      })
    )
  })

  it("rejects a cookie-authenticated request from an untrusted origin", async () => {
    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        Origin: webOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Minh",
        email: "csrf@example.com",
        password: "correct-horse-battery",
      }),
    })
    expect(signUp.status).toBe(200)

    const res = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example.com",
        Cookie: cookieHeader(signUp),
      },
    })

    expect(res.status).toBe(403)
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("uses default cookie attributes when AUTH_URL is local http", async () => {
    const signUp = await localApp.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        Origin: webOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Local",
        email: "local@example.com",
        password: "correct-horse-battery",
      }),
    })

    expect(signUp.status).toBe(200)
    const setCookie = sessionSetCookie(signUp)
    expect(setCookie).not.toMatch(/samesite=none/i)
    expect(setCookie).not.toMatch(/;\s*secure/i)
  })
})

describe("auth mail logging", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  async function requestReset(nodeEnv: string) {
    vi.stubEnv("NODE_ENV", nodeEnv)
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createTestApp(db)
      const email = `reset-${nodeEnv}@example.com`
      await signUp(app, {
        name: "Reset",
        email,
        password: "correct-horse-battery",
      })
      const res = await app.request("/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          Origin: testWebOrigin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, redirectTo: `${testWebOrigin}/reset` }),
      })
      expect(res.status).toBe(200)
      return log.mock.calls.map((call) => String(call[0]))
    } finally {
      await client.close()
    }
  }

  it("does not log reset or verify URLs in production", async () => {
    const lines = await requestReset("production")
    expect(lines.filter((line) => line.startsWith("[auth]"))).toEqual([])
  })

  it("logs the reset URL outside production", async () => {
    const lines = await requestReset("development")
    expect(
      lines.filter((line) => line.startsWith("[auth] password reset for"))
    ).toHaveLength(1)
  })
})
