import { AsyncLocalStorage } from "node:async_hooks"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP, genericOAuth } from "better-auth/plugins"

import { PROFILE_DEFAULTS } from "@workspace/domain"
import { eq } from "drizzle-orm"

import type { AppDatabase } from "./db/context.js"
import { user } from "./db/schema.js"
import { authSchema } from "./db/schema.js"
import { createAuthCodeSender } from "./mail/auth-code.js"
import { isAllowedOrigin } from "./origin.js"

export type AuthDatabase = Parameters<typeof drizzleAdapter>[0]

export type AuthConfig = {
  db: AuthDatabase
  sessionSecret: string
  authUrl: string
  webOrigins: string[]
  /** Default on. Tests turn this off so sign-in loops do not trip the limiter. */
  rateLimitEnabled?: boolean
  resendApiKey?: string
  authEmailFrom?: string
  googleClientId?: string
  googleClientSecret?: string
}

/**
 * Cookie attributes follow ADR-0006: `SameSite=None; Secure` when AUTH_URL is
 * https (cross-origin web ↔ api), browser defaults locally.
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
  resendApiKey,
  authEmailFrom,
  googleClientId,
  googleClientSecret,
}: AuthConfig) {
  const cookies = cookieAttributesForAuthUrl(authUrl)
  const googleId = googleClientId?.trim()
  const googleSecret = googleClientSecret?.trim()
  const emailCode = emailOTP({
    otpLength: 6,
    expiresIn: 300,
    storeOTP: "hashed",
    disableSignUp: false,
    allowedAttempts: 3,
    changeEmail: { enabled: true, verifyCurrentEmail: false },
    rateLimit: { window: 60, max: 3 },
    sendVerificationOTP: createAuthCodeSender({
      resendApiKey,
      from: authEmailFrom,
    }),
  })
  const google =
    googleId && googleSecret
      ? genericOAuth({
          config: [
            {
              providerId: "google",
              discoveryUrl:
                "https://accounts.google.com/.well-known/openid-configuration",
              clientId: googleId,
              clientSecret: googleSecret,
              scopes: ["openid", "email", "profile"],
            },
          ],
        })
      : null

  return betterAuth({
    appName: "opencv",
    secret: sessionSecret,
    baseURL: authUrl,
    basePath: "/api/auth",
    plugins: google ? [emailCode, google] : [emailCode],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: false,
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

let boundAuth: Auth | undefined

/** Last app to boot. A request store overrides this when two apps share a process. */
export function bindAuth(auth: Auth | undefined) {
  boundAuth = auth
}

type RequestStore = {
  headers: Headers
  auth?: Auth
}

const requestStore = new AsyncLocalStorage<RequestStore>()

export function withRequestHeaders<T>(
  headers: Headers,
  run: () => T,
  auth?: Auth
): T {
  return requestStore.run({ headers, auth }, run)
}

export function getRequestHeaders() {
  return requestStore.getStore()?.headers
}

export function getBoundAuth() {
  return requestStore.getStore()?.auth ?? boundAuth
}
