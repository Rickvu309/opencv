import { readFile } from "node:fs/promises"

import type { CoachMode, CoachRuntime } from "@workspace/domain"

import type { FetchJobPosting } from "../apply/fetch-posting.js"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"

import { createApp } from "../app.js"
import { migrationsFolder } from "../db/paths.js"
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

export async function createMigratedTestDb() {
  const templatePath = await injectedTemplatePath()
  if (templatePath) {
    templateBlob ??= readFile(templatePath).then((bytes) => new Blob([bytes]))
    const client = new PGlite({ loadDataDir: await templateBlob })
    return { client, db: drizzle({ client, schema }) }
  }

  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder })
  return { client, db }
}

export function createTestApp(
  db: ReturnType<typeof drizzle>,
  options?: {
    coach?: CoachRuntime
    coachModels?: Partial<Record<CoachMode, string>>
    /** One cap applied to every mode; `coachDailyTurnLimits` wins when both are set. */
    coachDailyTurnLimit?: number
    coachDailyTurnLimits?: Partial<Record<CoachMode, number>>
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
    coachModels: options?.coachModels,
    coachDailyTurnLimits:
      options?.coachDailyTurnLimits ??
      (options?.coachDailyTurnLimit === undefined
        ? undefined
        : {
            free: options.coachDailyTurnLimit,
            light: options.coachDailyTurnLimit,
            max: options.coachDailyTurnLimit,
          }),
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
