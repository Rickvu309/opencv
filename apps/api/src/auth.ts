import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import { PROFILE_DEFAULTS } from "@workspace/domain"
import { eq } from "drizzle-orm"

import type { AppDatabase } from "./db/context.js"
import { user } from "./db/schema.js"
import { authSchema } from "./db/schema.js"
import { isAllowedOrigin } from "./origin.js"

export type AuthDatabase = Parameters<typeof drizzleAdapter>[0]

export type AuthConfig = {
  db: AuthDatabase
  sessionSecret: string
  authUrl: string
  webOrigins: string[]
  /** Default on. Tests turn this off so sign-up loops do not trip the limiter. */
  rateLimitEnabled?: boolean
  /** Logs reset and verify URLs. Production passes false. */
  logAuthMail?: boolean
}

/**
 * Cookie attributes follow ADR-0006: `SameSite=None; Secure` when AUTH_URL is
 * https (cross-origin Vercel ↔ Railway), browser defaults locally.
 */
export function cookieAttributesForAuthUrl(authUrl: string) {
  const secure = authUrl.startsWith("https:")
  return {
    secure,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    httpOnly: true,
  }
}

export function createAuth({
  db,
  sessionSecret,
  authUrl,
  webOrigins,
  rateLimitEnabled = true,
  logAuthMail = true,
}: AuthConfig) {
  const cookies = cookieAttributesForAuthUrl(authUrl)

  return betterAuth({
    appName: "OpenCV",
    secret: sessionSecret,
    baseURL: authUrl,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        if (logAuthMail) {
          console.log(`[auth] password reset for ${user.email}: ${url}`)
        }
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        if (logAuthMail) {
          console.log(`[auth] verify email for ${user.email}: ${url}`)
        }
      },
    },
    trustedOrigins: (request) => {
      const origin = request?.headers.get("origin")
      if (origin && isAllowedOrigin(webOrigins, origin)) return [origin]
      return []
    },
    advanced: {
      useSecureCookies: cookies.secure,
      defaultCookieAttributes: cookies,
      // Better Auth skips origin checks when `isTest()`; keep one CORS/CSRF
      // policy in vitest and on Railway (ADR-0006).
      disableOriginCheck: false,
    },
    rateLimit: { enabled: rateLimitEnabled },
    telemetry: { enabled: false },
    databaseHooks: {
      user: {
        create: {
          after: async (created) => {
            await (db as AppDatabase)
              .update(user)
              .set({ ...PROFILE_DEFAULTS })
              .where(eq(user.id, created.id))
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
