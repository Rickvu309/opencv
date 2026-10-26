import { readFile } from "node:fs/promises"

import type { CoachRuntime } from "@workspace/domain"

import type { FetchJobPosting } from "../apply/fetch-posting.js"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"

import { createApp } from "../app.js"
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
    coachSseHeartbeatMs: options?.coachSseHeartbeatMs,
    fetchJobPosting: options?.fetchJobPosting,
  })
}

export async function signUp(
  app: ReturnType<typeof createApp>,
  user: { name: string; email: string; password: string }
) {
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      Origin: testWebOrigin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  })

  if (res.status !== 200) {
    throw new Error(`sign-up failed: ${res.status} ${await res.text()}`)
  }

  return {
    res,
    cookie: cookieHeader(res),
    user,
  }
}

export function authHeaders(cookie: string): Record<string, string> {
  return {
    Origin: testWebOrigin,
    Cookie: cookie,
    "Content-Type": "application/json",
  }
}
