import { readFile } from "node:fs/promises"

import type { CoachRuntime } from "@workspace/domain"

import type { FetchJobPosting } from "../job/index.js"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"

import { vi } from "vitest"

import { createApp } from "../app.js"
import {
  authEmailFromFromEnv,
  googleClientIdFromEnv,
  googleClientSecretFromEnv,
  googleEnabledFromEnv,
  resendApiKeyFromEnv,
} from "../config.js"
import type { AppDatabase, TestDatabase } from "../db/context.js"
import { runMigrations } from "../db/migrate.js"
import * as schema from "../db/schema.js"

export const testWebOrigin = "https://opencv.me"
export const testSessionSecret = "test-session-secret-that-is-at-least-32ch"
export const testAuthUrl = "https://api.example.com"

export function cookieHeader(res: Response) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ")
}

let templateBlob: Promise<Blob> | undefined

async function injectedTemplatePath() {
  if (!process.env.VITEST) return undefined
  try {
    return (await import("vitest")).inject("pgliteTemplatePath")
  } catch {
    return undefined
  }
}

export async function createMigratedTestDb(): Promise<{
  client: PGlite
  db: TestDatabase
}> {
  const templatePath = await injectedTemplatePath()
  if (templatePath) {
    templateBlob ??= readFile(templatePath).then((bytes) => new Blob([bytes]))
    const client = new PGlite({ loadDataDir: await templateBlob })
    return { client, db: drizzle({ client, schema }) }
  }

  const client = new PGlite()
  const db = drizzle({ client, schema })
  await runMigrations(db as unknown as AppDatabase)
  return { client, db }
}

export function createTestApp(
  db: ReturnType<typeof drizzle>,
  options?: {
    coach?: CoachRuntime
    coachDurable?: boolean
    coachCompatibilityMs?: number
    coachSseHeartbeatMs?: number
    fetchJobPosting?: FetchJobPosting
  }
) {
  return createApp({
    webOrigins: [testWebOrigin],
    sessionSecret: testSessionSecret,
    authUrl: testAuthUrl,
    db,
    rateLimitEnabled: false,
    coach: options?.coach,
    coachDurable: options?.coachDurable ?? false,
    coachCompatibilityMs: options?.coachCompatibilityMs,
    coachSseHeartbeatMs: options?.coachSseHeartbeatMs,
    fetchJobPosting: options?.fetchJobPosting,
    googleEnabled: googleEnabledFromEnv(process.env),
    googleClientId: googleClientIdFromEnv(process.env),
    googleClientSecret: googleClientSecretFromEnv(process.env),
    resendApiKey: resendApiKeyFromEnv(process.env),
    authEmailFrom: authEmailFromFromEnv(process.env),
  })
}

const codeLine = /^\[auth\] email code for (.+) type ([a-z-]+): ([0-9]{6})$/

export async function signUp(
  app: ReturnType<typeof createApp>,
  user: { name: string; email: string }
) {
  const log = vi.spyOn(console, "log").mockImplementation(() => {})
  try {
    const send = await app.request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: {
          Origin: testWebOrigin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: user.email, type: "sign-in" }),
      }
    )
    if (send.status !== 200) {
      throw new Error(
        `sign-in code failed: ${send.status} ${await send.text()}`
      )
    }
    const code = log.mock.calls
      .map((call) => String(call[0]).match(codeLine))
      .find(
        (match) =>
          match?.[1] === user.email.toLowerCase() && match[2] === "sign-in"
      )?.[3]
    if (!code) throw new Error("sign-in code was not logged")

    const res = await app.request("/api/auth/sign-in/email-otp", {
      method: "POST",
      headers: {
        Origin: testWebOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        otp: code,
        name: user.name,
      }),
    })
    if (res.status !== 200) {
      throw new Error(`sign-in failed: ${res.status} ${await res.text()}`)
    }
    return { res, cookie: cookieHeader(res), user }
  } finally {
    log.mockRestore()
  }
}

export function authHeaders(cookie: string): Record<string, string> {
  return {
    Origin: testWebOrigin,
    Cookie: cookie,
    "Content-Type": "application/json",
  }
}
