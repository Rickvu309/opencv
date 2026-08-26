import type { CoachMode, CoachRuntime } from "@workspace/domain"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"

import { createApp } from "../app.js"
import { migrationsFolder } from "../db/paths.js"
import * as schema from "../db/schema.js"

export const testWebOrigin = "https://openpath-app.vercel.app"
export const testSessionSecret = "test-session-secret-that-is-at-least-32ch"
export const testAuthUrl = "https://api.example.com"

export function cookieHeader(res: Response) {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ")
}

export async function createMigratedTestDb() {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder })
  return { client, db }
}

export function createTestApp(
  db: ReturnType<typeof drizzle>,
  options?: {
    coach?: CoachRuntime
    coachModel?: string
    coachDailyTurnLimit?: number
    coachModels?: Partial<Record<CoachMode, string>>
    coachDailyTurnLimits?: Partial<Record<CoachMode, number>>
    coachSseHeartbeatMs?: number
  }
) {
  return createApp({
    webOrigins: [testWebOrigin],
    sessionSecret: testSessionSecret,
    authUrl: testAuthUrl,
    db,
    rateLimitEnabled: false,
    coach: options?.coach,
    coachModel: options?.coachModel,
    coachDailyTurnLimit: options?.coachDailyTurnLimit,
    coachModels: options?.coachModels,
    coachDailyTurnLimits: options?.coachDailyTurnLimits,
    coachSseHeartbeatMs: options?.coachSseHeartbeatMs,
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
