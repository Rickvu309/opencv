import { AsyncLocalStorage } from "node:async_hooks"

import { oauthProvider } from "@better-auth/oauth-provider"
import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import {
  bindIssuedToken,
  assertRefreshGrant,
  hashAgentToken,
} from "./connections/index.js"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { emailOTP, genericOAuth } from "better-auth/plugins"

import { CONNECTION_TOKEN_SECONDS, PROFILE_DEFAULTS } from "@workspace/domain"
import { eq } from "drizzle-orm"

import type { AppDatabase } from "./db/context.js"
import { user } from "./db/schema.js"
import { authSchema } from "./db/schema.js"
import {
  authMailFailed,
  authMailId,
  createAuthCodeSender,
} from "./mail/auth-code.js"
import { isAllowedOrigin } from "./origin.js"

export type AuthDatabase = Parameters<typeof drizzleAdapter>[0]

export type AuthConfig = {
  db: AuthDatabase
  sessionSecret: string
  authUrl: string
  webOrigins: string[]
  rateLimitEnabled?: boolean
  sendCodeLimitEnabled?: boolean
  resendApiKey?: string
  authEmailFrom?: string
  logAuthMail?: boolean
  googleClientId?: string
  googleClientSecret?: string
}

const AUTH_EMAIL_FAILED = {
  code: "AUTH_EMAIL_FAILED",
  message: "We could not send the code. Try again.",
}

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
  sendCodeLimitEnabled = true,
  resendApiKey,
  authEmailFrom,
  logAuthMail = false,
  googleClientId,
  googleClientSecret,
}: AuthConfig) {
  const cookies = cookieAttributesForAuthUrl(authUrl)
  const signInOrigin = webOrigins.find((origin) => !origin.includes("*"))
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
      logOtp: logAuthMail,
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
    onAPIError: signInOrigin
      ? { errorURL: new URL("/sign-in", signInOrigin).toString() }
      : undefined,
    plugins: [
      emailCode,
      ...(google ? [google] : []),
      oauthProvider({
        loginPage: new URL("/oauth/connect", signInOrigin ?? authUrl).href,
        consentPage: new URL("/oauth/consent", signInOrigin ?? authUrl).href,
        disableJwtPlugin: true,
        dpop: { signingAlgorithms: [] },
        accessTokenExpiresIn: CONNECTION_TOKEN_SECONDS.access,
        refreshTokenExpiresIn: CONNECTION_TOKEN_SECONDS.refresh,
        storeTokens: { hash: hashAgentToken },
        scopes: [
          "connection.status",
          "job.read",
          "job.write",
          "offline_access",
        ],
        grantTypes: ["authorization_code", "refresh_token"],
        allowPublicClientPrelogin: true,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationDefaultResources: [new URL("/mcp", authUrl).href],
        resources: [
          {
            identifier: new URL("/mcp", authUrl).href,
            scopes: [
              "connection.status",
              "job.read",
              "job.write",
              "offline_access",
            ],
          },
        ],
        clientPrivileges: () => false,
        resourcePrivileges: () => false,
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
    ],
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
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    rateLimit: {
      enabled: rateLimitEnabled,
      customRules: sendCodeLimitEnabled
        ? undefined
        : { "/email-otp/send-verification-otp": false },
    },
    telemetry: { enabled: false },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/oauth2/token" && ctx.headers?.has("dpop"))
          throw new APIError("BAD_REQUEST", {
            error: "invalid_request",
            error_description: "Only Bearer tokens are supported",
          })
        if (
          ctx.path === "/oauth2/token" &&
          ctx.body?.grant_type === "refresh_token"
        )
          await assertRefreshGrant(ctx.body.refresh_token)
      }),
      after: createAuthMiddleware(
        async (ctx): Promise<Response | undefined> => {
          if (ctx.path === "/oauth2/token")
            await bindIssuedToken(
              ctx.context.returned,
              new URL("/mcp", authUrl).href
            )
          if (
            ctx.path !== "/email-otp/send-verification-otp" ||
            ctx.body?.type !== "sign-in"
          )
            return
          if (authMailFailed(ctx)) {
            return new Response(JSON.stringify(AUTH_EMAIL_FAILED), {
              status: 503,
              headers: { "content-type": "application/json" },
            })
          }
          const emailId = authMailId(ctx)
          if (emailId) {
            return new Response(JSON.stringify({ success: true, emailId }), {
              status: 200,
              headers: { "content-type": "application/json" },
            })
          }
        }
      ),
    },
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
