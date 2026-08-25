import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { afterEach, describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { cookieAttributesForAuthUrl } from "./auth.js"
import * as schema from "./db/schema.js"
import { migrationsFolder } from "./db/paths.js"

const webOrigin = "https://openpath-app.vercel.app"
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

async function createAuthedApp(authUrl = "https://api.example.com") {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder })

  const app = createApp({
    webOrigins: [webOrigin],
    sessionSecret,
    authUrl,
    db,
    rateLimitEnabled: false,
  })

  return { app, client }
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
  let client: PGlite | undefined

  afterEach(async () => {
    await client?.close()
    client = undefined
  })

  it("signs up, sets a cookie, and reads the authed session", async () => {
    const created = await createAuthedApp()
    client = created.client
    const { app } = created

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
  }, 60_000)

  it("returns a 401 envelope on a bare session read", async () => {
    const created = await createAuthedApp()
    client = created.client

    const res = await created.app.request("/api/session")

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    })
  }, 60_000)

  it("signs in, reads the session, then signs out", async () => {
    const created = await createAuthedApp()
    client = created.client
    const { app } = created
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
  }, 60_000)

  it("rejects a cookie-authenticated request from an untrusted origin", async () => {
    const created = await createAuthedApp()
    client = created.client
    const { app } = created

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
  }, 60_000)

  it("uses default cookie attributes when AUTH_URL is local http", async () => {
    const created = await createAuthedApp("http://localhost:3001")
    client = created.client

    const signUp = await created.app.request("/api/auth/sign-up/email", {
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
  }, 60_000)
})
