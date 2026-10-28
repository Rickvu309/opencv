import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createMigratedTestDb,
  createTestApp,
  testAuthUrl,
} from "./test/harness.js"
import { createAuthedApp, postJson, sendSignInCode } from "./auth.fixtures.js"

const authEmailFailedBody = {
  code: "AUTH_EMAIL_FAILED",
  message: "We could not send the code. Try again.",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function mailField(init: RequestInit | undefined, field: "to" | "text") {
  if (typeof init?.body !== "string") return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(init.body)
  } catch {
    return undefined
  }
  if (!isRecord(parsed)) return undefined
  const value = parsed[field]
  return typeof value === "string" ? value : undefined
}

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
      await expect(issued.res.json()).resolves.toEqual({ success: true })
      expect(issued.code).toMatch(/^[0-9]{6}$/)
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      await client.close()
    }
  })

  it("posts the code to Resend and hides it from the log", async () => {
    const fetchMock = vi.fn<
      (u: string, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(JSON.stringify({ id: "test-provider-message" }), {
          status: 200,
        })
    )
    vi.stubGlobal("fetch", fetchMock)
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client, db } = await createMigratedTestDb()
    const key = "test-resend-key"
    try {
      const app = createAuthedApp(db, testAuthUrl, {
        resendApiKey: `  ${key}  `,
        authEmailFrom: "  opencv <codes@opencv.me>  ",
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
      await expect(res.json()).resolves.toEqual({
        success: true,
        emailId: "test-provider-message",
      })
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

  it("returns each concurrent sign-in's own provider message ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url: string, init?: RequestInit) =>
          new Response(
            JSON.stringify({ id: `mail-for-${mailField(init, "to")}` }),
            { status: 200 }
          )
      )
    )
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createAuthedApp(db, testAuthUrl, {
        resendApiKey: "test-key",
        authEmailFrom: "codes@opencv.me",
        logAuthMail: false,
      })
      const addresses = ["first@verify.local", "second@verify.local"]
      const responses = await Promise.all(
        addresses.map((email) =>
          postJson(app, "/api/auth/email-otp/send-verification-otp", {
            email,
            type: "sign-in",
          })
        )
      )
      for (const [index, response] of responses.entries()) {
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
          success: true,
          emailId: `mail-for-${addresses[index]}`,
        })
      }
    } finally {
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
        logAuthMail: false,
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
      expect(logged).not.toContain("nope")
      expect(res.status).toBe(503)
      await expect(res.json()).resolves.toEqual(authEmailFailedBody)
    } finally {
      log.mockRestore()
      errorLog.mockRestore()
      await client.close()
    }
  })

  it("returns 503 when the provider rejects the connection", async () => {
    const key = "test-resend-key"
    const transport = "resend transport secret re_live_should_not_leak"
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(transport)
      })
    )
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createAuthedApp(db, testAuthUrl, {
        resendApiKey: key,
        authEmailFrom: "codes@opencv.me",
        logAuthMail: false,
      })
      const res = await postJson(
        app,
        "/api/auth/email-otp/send-verification-otp",
        {
          email: "net-fail@verify.local",
          type: "sign-in",
        }
      )
      const logged = [...log.mock.calls, ...errorLog.mock.calls].join(" ")
      expect(res.status).toBe(503)
      await expect(res.json()).resolves.toEqual(authEmailFailedBody)
      expect(logged).toContain(
        "[auth] email send failed for net-fail@verify.local type sign-in status 0"
      )
      expect(logged).not.toContain(key)
      expect(logged).not.toContain("re_live_should_not_leak")
      expect(logged).not.toMatch(/\[auth\] email code/)
      expect(logged).not.toMatch(/\b\d{6}\b/)
    } finally {
      log.mockRestore()
      errorLog.mockRestore()
      await client.close()
    }
  })

  it("returns 503 when mail config is missing or partial and logging is off", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client, db } = await createMigratedTestDb()
    const cases: Array<{
      email: string
      resendApiKey?: string
      authEmailFrom?: string
    }> = [
      { email: "missing@verify.local" },
      { email: "key-only@verify.local", resendApiKey: "test-resend-key" },
      { email: "from-only@verify.local", authEmailFrom: "codes@opencv.me" },
      {
        email: "blank-key@verify.local",
        resendApiKey: "   ",
        authEmailFrom: "  codes@opencv.me  ",
      },
    ]
    try {
      for (const mailCase of cases) {
        log.mockClear()
        errorLog.mockClear()
        const app = createAuthedApp(db, testAuthUrl, {
          resendApiKey: mailCase.resendApiKey,
          authEmailFrom: mailCase.authEmailFrom,
          logAuthMail: false,
        })
        const res = await postJson(
          app,
          "/api/auth/email-otp/send-verification-otp",
          { email: mailCase.email, type: "sign-in" }
        )
        const logged = [...log.mock.calls, ...errorLog.mock.calls].join(" ")
        expect(res.status).toBe(503)
        await expect(res.json()).resolves.toEqual(authEmailFailedBody)
        expect(log.mock.calls.map((call) => String(call[0]))).toEqual([
          "[auth] email send failed: mail is not configured",
        ])
        expect(logged).not.toMatch(/\[auth\] email code/)
        expect(logged).not.toMatch(/[0-9]{6}/)
        expect(logged).not.toContain("test-resend-key")
        expect(logged).not.toContain(mailCase.email)
      }
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
      errorLog.mockRestore()
      await client.close()
    }
  })

  it("logs the code when only one mail field is set and logging stays on", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createAuthedApp(db, testAuthUrl, {
        resendApiKey: "test-resend-key",
      })
      const issued = await sendSignInCode(app, "partial-log@verify.local")
      expect(issued.res.status).toBe(200)
      await expect(issued.res.json()).resolves.toEqual({ success: true })
      expect(issued.code).toMatch(/^[0-9]{6}$/)
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      await client.close()
    }
  })

  it("keeps a failed send from changing a concurrent success", async () => {
    let markFailed: (() => void) | undefined
    const failedSettled = new Promise<void>((resolve) => {
      markFailed = resolve
    })
    const key = "test-resend-key"
    const failEmail = "fail-concurrent@verify.local"
    const okEmail = "ok-concurrent@verify.local"
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (mailField(init, "to") === failEmail) {
          return new Response("nope", { status: 500 })
        }
        await failedSettled
        return new Response("{}", { status: 200 })
      })
    )
    const log = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client, db } = await createMigratedTestDb()
    try {
      const app = createAuthedApp(db, testAuthUrl, {
        resendApiKey: key,
        authEmailFrom: "codes@opencv.me",
        logAuthMail: false,
      })
      const failedPromise = Promise.resolve(
        postJson(app, "/api/auth/email-otp/send-verification-otp", {
          email: failEmail,
          type: "sign-in",
        })
      ).then((res) => {
        markFailed?.()
        return res
      })
      const okPromise = postJson(
        app,
        "/api/auth/email-otp/send-verification-otp",
        { email: okEmail, type: "sign-in" }
      )
      const [failed, ok] = await Promise.all([failedPromise, okPromise])
      expect(failed.status).toBe(503)
      await expect(failed.json()).resolves.toEqual(authEmailFailedBody)
      expect(ok.status).toBe(200)
      await expect(ok.json()).resolves.toEqual({ success: true })
      const logged = [...log.mock.calls, ...errorLog.mock.calls].join(" ")
      expect(logged).toContain(
        `[auth] email send failed for ${failEmail} type sign-in status 500`
      )
      expect(logged).not.toContain(key)
      expect(logged).not.toContain("nope")
      expect(logged).not.toMatch(/\[auth\] email code/)
      expect(logged).not.toMatch(/\b\d{6}\b/)
    } finally {
      markFailed?.()
      log.mockRestore()
      errorLog.mockRestore()
      await client.close()
    }
  })
})
