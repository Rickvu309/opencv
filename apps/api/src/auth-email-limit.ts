import { createHmac } from "node:crypto"

import { and, eq, inArray, lt, sql } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"

import { authRoute } from "./auth-routes.js"
import type { AppDatabase } from "./db/context.js"
import { authLimitCounters } from "./db/schema.js"

const MINUTE_MS = 60_000
const QUARTER_HOUR_MS = 15 * MINUTE_MS
const HOUR_MS = 60 * MINUTE_MS

export const DEFAULT_AUTH_CODE_SEND_WARNING_PER_HOUR = 200

export type AuthEmailCaps = {
  sendsPerEmailPerQuarterHour: number
  sendsPerEmailPerHour: number
  sendWarningPerHour: number
}

export const AUTH_EMAIL_CAPS: AuthEmailCaps = {
  sendsPerEmailPerQuarterHour: 5,
  sendsPerEmailPerHour: 10,
  sendWarningPerHour: DEFAULT_AUTH_CODE_SEND_WARNING_PER_HOUR,
}

const SEND_SCOPES = ["send-15m", "send-hour"] as const

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
    retryAfter: secondsLeftInWindow(windowMs, now),
  }
}

function secondsLeftInWindow(windowMs: number, now: number) {
  const start = Math.floor(now / windowMs) * windowMs
  return Math.max(1, Math.ceil((start + windowMs - now) / 1000))
}

export async function readCountInWindow(
  db: AppDatabase,
  key: string,
  windowMs: number,
  now: number
) {
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  const [row] = await db
    .select({ count: authLimitCounters.count })
    .from(authLimitCounters)
    .where(
      and(
        eq(authLimitCounters.key, key),
        eq(authLimitCounters.windowStart, windowStart)
      )
    )
  return {
    count: row?.count ?? 0,
    retryAfter: secondsLeftInWindow(windowMs, now),
  }
}

export async function clearAuthSendCounts(
  db: AppDatabase,
  secret: string,
  email: string
) {
  await db.delete(authLimitCounters).where(
    inArray(
      authLimitCounters.key,
      SEND_SCOPES.map((scope) => authLimitKey(secret, scope, email))
    )
  )
}

export function sendWarningLine(count: number, threshold: number, now: number) {
  if (count <= threshold || (count - 1) % threshold !== 0) return null
  const hour = new Date(Math.floor(now / HOUR_MS) * HOUR_MS).toISOString()
  return `[auth] ${count} sign-in codes sent in the hour starting ${hour}, above the warning level of ${threshold}`
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
}

export function authEmailLimit({
  db,
  secret,
  caps,
  limitSends,
}: AuthEmailLimitOptions): MiddlewareHandler {
  const cap = { ...AUTH_EMAIL_CAPS, ...caps }

  async function refuseSend(email: string, now: number) {
    const quarter = await countInWindow(
      db,
      authLimitKey(secret, "send-15m", email),
      QUARTER_HOUR_MS,
      now
    )
    const hourKey = authLimitKey(secret, "send-hour", email)
    if (quarter.count > cap.sendsPerEmailPerQuarterHour) {
      const hourSoFar = await readCountInWindow(db, hourKey, HOUR_MS, now)
      const hourAlsoRefuses = hourSoFar.count >= cap.sendsPerEmailPerHour
      return authLimitedResponse(
        hourAlsoRefuses
          ? Math.max(quarter.retryAfter, hourSoFar.retryAfter)
          : quarter.retryAfter
      )
    }
    const hour = await countInWindow(db, hourKey, HOUR_MS, now)
    if (hour.count > cap.sendsPerEmailPerHour)
      return authLimitedResponse(hour.retryAfter)
    const all = await countInWindow(db, "send-hour:all", HOUR_MS, now)
    if (all.count === 1) await removeExpiredAuthLimits(db, now)
    const warning = sendWarningLine(all.count, cap.sendWarningPerHour, now)
    if (warning) console.warn(warning)
    return null
  }

  return async (c, next) => {
    const route = limitSends ? authRoute(c.req.path) : null
    if (route === null) return next()
    const sendField = CODE_SENDING_AUTH_PATHS.get(route)
    const field = sendField ?? CODE_CHECKING_AUTH_PATHS.get(route)
    if (!field) return next()
    const raw = await bodyField(c.req.raw, field)
    if (raw === null) return next()
    if (sendField) {
      const refused = await refuseSend(raw, Date.now())
      if (refused) return refused
      return next()
    }
    await next()
    if (c.res.status !== 200) return
    try {
      await clearAuthSendCounts(db, secret, raw)
    } catch {
      console.warn("sign-in succeeded but its send counts were not cleared")
    }
  }
}
