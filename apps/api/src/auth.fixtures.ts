import type { drizzle } from "drizzle-orm/pglite"
import { vi } from "vitest"
import { createApp } from "./app.js"
import { testSessionSecret, testWebOrigin } from "./test/harness.js"

export const webOrigin = testWebOrigin
const sessionSecret = testSessionSecret

export const codeLine =
  /^\[auth\] email code for (.+) type ([a-z-]+): ([0-9]{6})$/

export function cookieHeader(res: Response) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ")
}

export function sessionSetCookie(res: Response) {
  return (
    res.headers
      .getSetCookie()
      .find((cookie) => cookie.toLowerCase().includes("session_token")) ?? ""
  )
}

export function createAuthedApp(
  db: ReturnType<typeof drizzle>,
  authUrl: string,
  options?: {
    rateLimitEnabled?: boolean
    sendCodeLimitEnabled?: boolean
    resendApiKey?: string
    authEmailFrom?: string
    logAuthMail?: boolean
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
    sendCodeLimitEnabled: options?.sendCodeLimitEnabled,
    resendApiKey: options?.resendApiKey,
    authEmailFrom: options?.authEmailFrom,
    logAuthMail: options?.logAuthMail,
    googleEnabled: options?.googleEnabled ?? false,
    googleClientId: options?.googleClientId,
    googleClientSecret: options?.googleClientSecret,
  })
}

export function jsonHeaders(extra?: Record<string, string>) {
  return {
    Origin: webOrigin,
    "Content-Type": "application/json",
    ...extra,
  }
}

export function postJson(
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

export async function sendSignInCode(
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

export async function signInWithCode(
  app: ReturnType<typeof createApp>,
  email: string,
  otp: string,
  extra?: { name?: string }
) {
  return postJson(app, "/api/auth/sign-in/email-otp", { email, otp, ...extra })
}
