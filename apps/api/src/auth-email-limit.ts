import { createHmac } from "node:crypto"

import { and, eq, lt, sql } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"

import { authRoute } from "./auth-routes.js"
import type { AppDatabase } from "./db/context.js"
import { authLimitCounters } from "./db/schema.js"

const MINUTE_MS = 60_000
const QUARTER_HOUR_MS = 15 * MINUTE_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

export const DEFAULT_AUTH_CODE_SENDS_PER_HOUR = 30

export type AuthEmailCaps = {
  sendsPerEmailPerQuarterHour: number
  sendsPerEmailPerDay: number
  sendsPerHour: number
  failedChecksPerEmailPerDay: number
}

export const AUTH_EMAIL_CAPS: AuthEmailCaps = {
  sendsPerEmailPerQuarterHour: 5,
  sendsPerEmailPerDay: 20,
  sendsPerHour: DEFAULT_AUTH_CODE_SENDS_PER_HOUR,
  failedChecksPerEmailPerDay: 10,
}

export const CODE_SENDING_AUTH_PATHS: ReadonlyMap<string, string> = new Map([
  ["/email-otp/send-verification-otp", "email"],
  ["/email-otp/request-email-change", "newEmail"],
  ["/email-otp/request-password-reset", "email"],
  ["/forget-password/email-otp", "email"],
])

export const CODE_CHECKING_AUTH_PATHS: ReadonlyMap<string, string> = new Map([
  ["/sign-in/email-otp", "email"],
  ["/email-otp/change-email", "newEmail"],
  ["/email-otp/verify-email", "email"],
  ["/email-otp/reset-password", "email"],
  ["/email-otp/check-verification-otp", "email"],
])

const FAILED_CHECK_STATUSES = new Set([400, 403])

export function normalizedAuthEmail(value: string) {
  return value.trim().toLowerCase()
}

export function authLimitKey(secret: string, scope: string, email: string) {
  const digest = createHmac("sha256", secret)
    .update(`${scope}\n${normalizedAuthEmail(email)}`)
    .digest("hex")
  return `${scope}:${digest}`
}

export function authLimitedResponse(retryAfterSeconds: number) {
  const seconds = String(retryAfterSeconds)
  return new Response(
    JSON.stringify({ message: "Too many requests. Please try again later." }),
    {
      status: 429,
      statusText: "Too Many Requests",
      headers: {
        "Content-Type": "application/json",
        "X-Retry-After": seconds,
        "Retry-After": seconds,
      },
    }
  )
}

type WindowCount = { count: number; windowStart: Date; retryAfter: number }

export async function countInWindow(
  db: AppDatabase,
  key: string,
  windowMs: number,
  now: number
): Promise<WindowCount> {
  const start = Math.floor(now / windowMs) * windowMs
  const windowStart = new Date(start)
  const [row] = await db
    .insert(authLimitCounters)
    .values({
      key,
      windowStart,
      count: 1,
      expiresAt: new Date(start + windowMs),
    })
    .onConflictDoUpdate({
      target: [authLimitCounters.key, authLimitCounters.windowStart],
      set: { count: sql`${authLimitCounters.count} + 1` },
    })
    .returning({ count: authLimitCounters.count })
  return {
    count: row?.count ?? Number.POSITIVE_INFINITY,
    windowStart,
    retryAfter: Math.max(1, Math.ceil((start + windowMs - now) / 1000)),
  }
}

async function giveBack(db: AppDatabase, key: string, windowStart: Date) {
  await db
    .update(authLimitCounters)
    .set({ count: sql`${authLimitCounters.count} - 1` })
    .where(
      and(
        eq(authLimitCounters.key, key),
        eq(authLimitCounters.windowStart, windowStart)
      )
    )
}

export async function removeExpiredAuthLimits(db: AppDatabase, now: number) {
  await db
    .delete(authLimitCounters)
    .where(lt(authLimitCounters.expiresAt, new Date(now)))
}

async function bodyField(request: Request, field: string) {
  const type = (request.headers.get("content-type") ?? "").toLowerCase()
  const copy = request.clone()
  let body: unknown = null
  if (/^application\/([a-z0-9.+-]*\+)?json/.test(type))
    body = await copy.json().catch(() => null)
  else if (
    type.includes("application/x-www-form-urlencoded") ||
    type.includes("multipart/form-data")
  )
    body = await copy
      .formData()
      .then((form) => Object.fromEntries(form))
      .catch(() => null)
  if (!body || typeof body !== "object" || !(field in body)) return null
  const value: unknown = (body as Record<string, unknown>)[field]
  return typeof value === "string" ? value : null
}

type AuthEmailLimitOptions = {
  db: AppDatabase
  secret: string
  caps?: Partial<AuthEmailCaps>
  limitSends: boolean
  limitChecks: boolean
}

export function authEmailLimit({
  db,
  secret,
  caps,
  limitSends,
  limitChecks,
}: AuthEmailLimitOptions): MiddlewareHandler {
  const cap = { ...AUTH_EMAIL_CAPS, ...caps }

  async function refuseSend(email: string, now: number) {
    const quarter = await countInWindow(
      db,
      authLimitKey(secret, "send-15m", email),
      QUARTER_HOUR_MS,
      now
    )
    if (quarter.count > cap.sendsPerEmailPerQuarterHour)
      return authLimitedResponse(quarter.retryAfter)
    const day = await countInWindow(
      db,
      authLimitKey(secret, "send-day", email),
      DAY_MS,
      now
    )
    if (day.count > cap.sendsPerEmailPerDay)
      return authLimitedResponse(day.retryAfter)
    const all = await countInWindow(db, "send-hour:all", HOUR_MS, now)
    if (all.count === 1) await removeExpiredAuthLimits(db, now)
    if (all.count > cap.sendsPerHour) return authLimitedResponse(all.retryAfter)
    return null
  }

  return async (c, next) => {
    const route = authRoute(c.req.path)
    const sendField = route ? CODE_SENDING_AUTH_PATHS.get(route) : undefined
    const checkField = route ? CODE_CHECKING_AUTH_PATHS.get(route) : undefined
    const field = limitSends ? sendField : undefined
    const checked = limitChecks ? checkField : undefined
    if (!field && !checked) return next()
    const raw = await bodyField(c.req.raw, (field ?? checked) as string)
    if (raw === null) return next()
    const now = Date.now()
    if (field) {
      const refused = await refuseSend(raw, now)
      if (refused) return refused
      return next()
    }
    const key = authLimitKey(secret, "failed-check-day", raw)
    const reserved = await countInWindow(db, key, DAY_MS, now)
    if (reserved.count > cap.failedChecksPerEmailPerDay)
      return authLimitedResponse(reserved.retryAfter)
    await next()
    if (!FAILED_CHECK_STATUSES.has(c.res.status))
      await giveBack(db, key, reserved.windowStart)
  }
}
