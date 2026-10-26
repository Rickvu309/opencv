import { eq } from "drizzle-orm"
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
import { user, verification } from "./db/schema.js"
import {
  createMigratedTestDb,
  createTestApp,
  testAuthUrl,
  testSessionSecret,
  testWebOrigin,
} from "./test/harness.js"

const webOrigin = testWebOrigin
const sessionSecret = testSessionSecret

const codeLine = /^\[auth\] email code for (.+) type ([a-z-]+): ([0-9]{6})$/

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

function createAuthedApp(
  db: ReturnType<typeof drizzle>,
  authUrl: string,
  options?: {
    rateLimitEnabled?: boolean
    resendApiKey?: string
    authEmailFrom?: string
    googleEnabled?: boolean
    googleClientId?: string
    googleClientSecret?: string
  }
) {
  return createApp({
    webOrigins: [webOrigin],
    sessionSecret,
    authUrl,
    db,
    rateLimitEnabled: options?.rateLimitEnabled ?? false,
    resendApiKey: options?.resendApiKey,
    authEmailFrom: options?.authEmailFrom,
    googleEnabled: options?.googleEnabled ?? false,
    googleClientId: options?.googleClientId,
    googleClientSecret: options?.googleClientSecret,
  })
}

function jsonHeaders(extra?: Record<string, string>) {
  return {
    Origin: webOrigin,
    "Content-Type": "application/json",
    ...extra,
  }
}

function postJson(
  app: ReturnType<typeof createApp>,
  path: string,
  body: unknown,
  extra?: Record<string, string>
) {
  return app.request(path, {
    method: "POST",
    headers: jsonHeaders(extra),
    body: JSON.stringify(body),
  })
}

async function sendSignInCode(
  app: ReturnType<typeof createApp>,
  email: string
) {
  const log = vi.spyOn(console, "log").mockImplementation(() => {})
  try {
    const res = await postJson(
      app,
      "/api/auth/email-otp/send-verification-otp",
      {
        email,
        type: "sign-in",
      }
    )
    const lines = log.mock.calls.map((call) => String(call[0]))
    const match = lines
      .map((line) => line.match(codeLine))
      .find((row) => row?.[1] === email.toLowerCase() && row[2] === "sign-in")
    return { res, lines, code: match?.[3] }
  } finally {
    log.mockRestore()
  }
}

async function signInWithCode(
  app: ReturnType<typeof createApp>,
  email: string,
  otp: string,
  extra?: { name?: string }
) {
  return postJson(app, "/api/auth/sign-in/email-otp", { email, otp, ...extra })
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
  let db: ReturnType<typeof drizzle>
  let app: ReturnType<typeof createApp>
  let localApp: ReturnType<typeof createApp>

  beforeAll(async () => {
    client = new PGlite()
    db = drizzle({ client, schema })
    await runMigrations(db as unknown as AppDatabase)
    app = createAuthedApp(db, testAuthUrl)
    localApp = createAuthedApp(db, "http://localhost:3001")
  }, 60_000)

  afterAll(async () => {
    await client.close()
  })

  async function signedIn(email: string, name?: string) {
    const issued = await sendSignInCode(app, email)
    expect(issued.res.status).toBe(200)
    expect(issued.code).toMatch(/^[0-9]{6}$/)
    const signIn = await signInWithCode(
      app,
      email,
      issued.code ?? "",
      name ? { name } : undefined
    )
    expect(signIn.status).toBe(200)
    return signIn
  }

  it("signs in by code, sets a cookie, and reads the session", async () => {
    const signIn = await signedIn("minh@example.com", "Minh")

    expect(sessionSetCookie(signIn)).toMatch(/session_token/i)
    expect(sessionSetCookie(signIn)).toMatch(/samesite=none/i)
    expect(sessionSetCookie(signIn)).toMatch(/secure/i)

    const session = await app.request("/api/session", {
      headers: {
        Origin: webOrigin,
        Cookie: cookieHeader(signIn),
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
    const email = "lan@example.com"
    const first = await signedIn(email, "Lan")
    const signOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: webOrigin,
        Cookie: cookieHeader(first),
      },
    })
    expect(signOut.status).toBe(200)

    const afterSignOut = await app.request("/api/session", {
      headers: { Cookie: cookieHeader(signOut) },
    })
    expect(afterSignOut.status).toBe(401)

    const issued = await sendSignInCode(app, email)
    expect(issued.code).toMatch(/^[0-9]{6}$/)
    const signIn = await signInWithCode(app, email, issued.code ?? "")
    expect(signIn.status).toBe(200)

    const session = await app.request("/api/session", {
      headers: { Cookie: cookieHeader(signIn) },
    })
    expect(session.status).toBe(200)
    await expect(session.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        user: expect.objectContaining({ email }),
      })
    )
  })

  it("rejects a cookie-authenticated request from an untrusted origin", async () => {
    const signIn = await signedIn("csrf@example.com", "Minh")

    const res = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example.com",
        Cookie: cookieHeader(signIn),
      },
    })

    expect(res.status).toBe(403)
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("uses default cookie attributes when AUTH_URL is local http", async () => {
    const issued = await sendSignInCode(localApp, "local@example.com")
    expect(issued.code).toMatch(/^[0-9]{6}$/)
    const signIn = await localApp.request("/api/auth/sign-in/email-otp", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        email: "local@example.com",
        otp: issued.code,
        name: "Local",
      }),
    })

    expect(signIn.status).toBe(200)
    const setCookie = sessionSetCookie(signIn)
    expect(setCookie).not.toMatch(/samesite=none/i)
    expect(setCookie).not.toMatch(/;\s*secure/i)
  })

  it("issues a code without creating a user, then verifies it", async () => {
    const email = "ada@verify.local"
    const issued = await sendSignInCode(app, email)
    expect(issued.res.status).toBe(200)
    await expect(issued.res.json()).resolves.toEqual({ success: true })
    expect(issued.lines.some((line) => codeLine.test(line))).toBe(true)
    expect(issued.code).toMatch(/^[0-9]{6}$/)

    const people = await db.select().from(user).where(eq(user.email, email))
    expect(people).toHaveLength(0)
    const rows = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, `sign-in-otp-${email}`))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value.startsWith(issued.code ?? "x")).toBe(false)

    const signIn = await signInWithCode(app, email, issued.code ?? "")
    expect(signIn.status).toBe(200)
    expect(sessionSetCookie(signIn)).toMatch(/session_token/i)
    const created = await db.select().from(user).where(eq(user.email, email))
    expect(created[0]?.emailVerified).toBe(true)
    expect(created[0]?.name).toBe("")

    const again = await signInWithCode(app, email, issued.code ?? "")
    expect(again.status).toBe(400)
    await expect(again.json()).resolves.toMatchObject({ code: "INVALID_OTP" })

    const profile = await app.request("/api/profile", {
      headers: { Origin: webOrigin, Cookie: cookieHeader(signIn) },
    })
    expect(profile.status).toBe(200)
    const profileBody = (await profile.json()) as {
      data: { plan: string; language: string; welcomedAt: string | null }
    }
    expect(profileBody.data).toMatchObject({
      plan: "free",
      language: "en",
      welcomedAt: null,
    })
  })

  it("accepts the right code after one wrong try", async () => {
    const email = "wrong-once@verify.local"
    const issued = await sendSignInCode(app, email)
    const wrong = await signInWithCode(app, email, "000000")
    expect(wrong.status).toBe(400)
    await expect(wrong.json()).resolves.toMatchObject({ code: "INVALID_OTP" })
    const right = await signInWithCode(app, email, issued.code ?? "")
    expect(right.status).toBe(200)
  })

  it("locks the code after three wrong tries", async () => {
    const email = "locked@verify.local"
    const issued = await sendSignInCode(app, email)
    for (const guess of ["111111", "222222", "333333"]) {
      const wrong = await signInWithCode(app, email, guess)
      expect(wrong.status).toBe(400)
      await expect(wrong.json()).resolves.toMatchObject({ code: "INVALID_OTP" })
    }
    const fourth = await signInWithCode(app, email, issued.code ?? "")
    expect(fourth.status).toBe(403)
    await expect(fourth.json()).resolves.toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
    })
  })

  it("rejects an expired code", async () => {
    const email = "expired@verify.local"
    const issued = await sendSignInCode(app, email)
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verification.identifier, `sign-in-otp-${email}`))
    const res = await signInWithCode(app, email, issued.code ?? "")
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ code: "OTP_EXPIRED" })
  })

  it("marks welcome once", async () => {
    const email = "welcome@verify.local"
    const signIn = await signedIn(email)
    const headers = {
      ...jsonHeaders(),
      Cookie: cookieHeader(signIn),
    }
    const first = await app.request("/api/commands/profile.markWelcomed", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as {
      data: { welcomedAt: string }
    }
    expect(firstBody.data.welcomedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const second = await app.request("/api/commands/profile.markWelcomed", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: {} }),
    })
    const secondBody = (await second.json()) as {
      data: { welcomedAt: string }
    }
    expect(secondBody.data.welcomedAt).toBe(firstBody.data.welcomedAt)
  })

  it("sends a change-email code and rejects the current address", async () => {
    const email = "change@verify.local"
    const signIn = await signedIn(email, "Ada")
    const headers = {
      ...jsonHeaders(),
      Cookie: cookieHeader(signIn),
    }
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    try {
      const sent = await app.request(
        "/api/commands/account.requestEmailChange",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ input: { email: "next@verify.local" } }),
        }
      )
      expect(sent.status).toBe(200)
      await expect(sent.json()).resolves.toEqual({
        ok: true,
        data: { email: "next@verify.local", sent: true },
      })
      const match = log.mock.calls
        .map((call) => String(call[0]).match(codeLine))
        .find((row) => row?.[2] === "change-email")
      expect(match?.[1]).toBe("next@verify.local")
      const code = match?.[3] ?? ""
      expect(code).toMatch(/^[0-9]{6}$/)
      const changed = await app.request("/api/auth/email-otp/change-email", {
        method: "POST",
        headers,
        body: JSON.stringify({ newEmail: "next@verify.local", otp: code }),
      })
      expect(changed.status).toBe(200)
      await expect(changed.json()).resolves.toEqual({ success: true })
      const same = await app.request(
        "/api/commands/account.requestEmailChange",
        {
          method: "POST",
          headers: { ...jsonHeaders(), Cookie: cookieHeader(changed) },
          body: JSON.stringify({ input: { email: "next@verify.local" } }),
        }
      )
      expect(same.status).toBe(400)
      await expect(same.json()).resolves.toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Use a different email." },
      })
    } finally {
      log.mockRestore()
    }
  })
})

describe("auth code delivery", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("logs the code and does not call fetch when Resend is unset", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createTestApp(db)
      const issued = await sendSignInCode(app, "log@verify.local")
      expect(issued.res.status).toBe(200)
      expect(issued.code).toMatch(/^[0-9]{6}$/)
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      await client.close()
    }
  })

  it("posts the code to Resend and hides it from the log", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client, db } = await createMigratedTestDb()
    const key = "test-resend-key"
    try {
      const app = createAuthedApp(db, testAuthUrl, {
        resendApiKey: key,
        authEmailFrom: "opencv <codes@opencv.me>",
      })
      const res = await postJson(
        app,
        "/api/auth/email-otp/send-verification-otp",
        {
          email: "resend@verify.local",
          type: "sign-in",
        }
      )
      expect(res.status).toBe(200)
      const init = fetchMock.mock.calls[0]?.[1] as RequestInit
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
        "https://api.resend.com/emails"
      )
      expect(new Headers(init.headers).get("Authorization")).toBe(
        `Bearer ${key}`
      )
      const body = JSON.parse(String(init.body)) as {
        from: string
        to: string
        subject: string
        text: string
      }
      expect(body).toMatchObject({
        from: "opencv <codes@opencv.me>",
        to: "resend@verify.local",
        subject: "Your opencv code",
      })
      expect(body.text).toMatch(/[0-9]{6}/)
      const logged = [...log.mock.calls, ...errorLog.mock.calls].join(" ")
      expect(logged).not.toContain(key)
      expect(logged).not.toMatch(/\[auth\] email code/)
    } finally {
      log.mockRestore()
      errorLog.mockRestore()
      await client.close()
    }
  })

  it("logs a Resend failure without the code or the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 }))
    )
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client, db } = await createMigratedTestDb()
    const key = "test-resend-key"
    try {
      const app = createAuthedApp(db, testAuthUrl, {
        resendApiKey: key,
        authEmailFrom: "codes@opencv.me",
      })
      const res = await postJson(
        app,
        "/api/auth/email-otp/send-verification-otp",
        {
          email: "resend-fail@verify.local",
          type: "sign-in",
        }
      )
      const logged = [...log.mock.calls, ...errorLog.mock.calls].join(" ")
      expect(logged).toContain(
        "[auth] email send failed for resend-fail@verify.local type sign-in status 500"
      )
      expect(logged).not.toContain(key)
      expect(logged).not.toMatch(/\[auth\] email code/)
      expect(logged).not.toMatch(/\b\d{6}\b/)
      expect(res.status).toBe(200)
    } finally {
      log.mockRestore()
      errorLog.mockRestore()
      await client.close()
    }
  })
})

describe("auth providers", () => {
  it("rate limits the fourth code send", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createAuthedApp(db, testAuthUrl, { rateLimitEnabled: true })
      const email = "limited@verify.local"
      for (let i = 0; i < 3; i += 1) {
        const res = await postJson(
          app,
          "/api/auth/email-otp/send-verification-otp",
          {
            email,
            type: "sign-in",
          }
        )
        expect(res.status).toBe(200)
      }
      const limited = await postJson(
        app,
        "/api/auth/email-otp/send-verification-otp",
        { email, type: "sign-in" }
      )
      expect(limited.status).toBe(429)
      expect(limited.headers.get("X-Retry-After")).toBeTruthy()
      await expect(limited.json()).resolves.toEqual({
        message: "Too many requests. Please try again later.",
      })
    } finally {
      await client.close()
    }
  })

  it("hides Google when the env is unset", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createTestApp(db)
      const config = await app.request("/api/public-config")
      await expect(config.json()).resolves.toEqual({ google: false })
      const social = await postJson(app, "/api/auth/sign-in/social", {
        provider: "google",
        callbackURL: "http://localhost:5173/app",
      })
      expect(social.status).not.toBe(200)
      expect(await social.text()).not.toContain("https://accounts.google.com")
    } finally {
      await client.close()
    }
  })

  it("refuses password sign-in and sign-up", async () => {
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createTestApp(db)
      const signIn = await postJson(app, "/api/auth/sign-in/email", {
        email: "ada@verify.local",
        password: "correct-horse-battery",
      })
      expect(signIn.status).toBe(400)
      await expect(signIn.json()).resolves.toMatchObject({
        code: "EMAIL_PASSWORD_DISABLED",
        message: "Email and password is not enabled",
      })
      const signUp = await postJson(app, "/api/auth/sign-up/email", {
        name: "Ada",
        email: "ada@verify.local",
        password: "correct-horse-battery",
      })
      expect(signUp.status).toBe(400)
      await expect(signUp.json()).resolves.toMatchObject({
        code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
        message: "Email and password sign up is not enabled",
      })
    } finally {
      await client.close()
    }
  })
})
