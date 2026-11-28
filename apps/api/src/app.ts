import { handleAuthRequest } from "./auth-consent.js"
import { connectionRoutes } from "./connections/index.js"
import type { CoachRuntime } from "@workspace/domain/coach"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"

import { createAccountRoutes, hostEmailChangeCode } from "./account/index.js"
import {
  createAuth,
  emailChangeCodeFromRequest,
  type AuthDatabase,
} from "./auth.js"
import { authEmailLimit } from "./auth-email-limit.js"
import { isServedAuthPath } from "./auth-routes.js"
import {
  createCoachRoutes,
  createCoachTaskRoutes,
  interpretPosting,
} from "./coach/index.js"
import {
  coachWorkerEnabledFromEnv,
  logAuthMailFromEnv,
  setCoachModelEnv,
  type CoachModelEnv,
} from "./platform/config.js"
import { withDatabase, type AppDatabase } from "./db/context.js"
import { authUnavailableEnvelope } from "./platform/envelope.js"
import { createHealthRoutes } from "./health.js"
import { createInboxRoutes } from "./inbox/index.js"
import { type FetchJobPosting } from "./job/index.js"
import { currentSession, requireSession } from "./middleware.js"
import {
  handleApiError,
  notFoundEnvelopeResponse,
} from "./platform/error-reply.js"
import { authMailConfigured } from "./mail/auth-code.js"
import {
  oauthClientLimit,
  type OAuthClientLimits,
} from "./oauth-client-limit.js"
import { isAllowedOrigin } from "./platform/origin.js"
import { createPaperRoutes } from "./paper/index.js"
import { createReadRoutes } from "./registry/read.js"
import { createCommandRoutes } from "./registry/http.js"
import { installRegistry } from "./install.js"

export type AppConfig = {
  webOrigins: string[]
  databaseUrl?: string
  sessionSecret?: string
  authUrl?: string
  db?: AuthDatabase
  rateLimitEnabled?: boolean
  sendCodeLimitEnabled?: boolean
  authCodeSendWarningPerHour?: number
  coach?: CoachRuntime
  coachDurable?: boolean
  coachCompatibilityMs?: number
  coachSseHeartbeatMs?: number
  coachEnv?: CoachModelEnv
  gmailEnabled?: boolean
  googleEnabled?: boolean
  googleClientId?: string
  googleClientSecret?: string
  resendApiKey?: string
  authEmailFrom?: string
  logAuthMail?: boolean
  interpretPostings?: boolean
  fetchJobPosting?: FetchJobPosting
  commitSha?: string
  healthDbTimeoutMs?: number
  oauthClientLimits?: OAuthClientLimits
  oauthClientClock?: () => Date
}

export function createApp({
  webOrigins,
  sessionSecret,
  authUrl,
  db,
  rateLimitEnabled,
  sendCodeLimitEnabled,
  authCodeSendWarningPerHour,
  coach,
  coachDurable = coachWorkerEnabledFromEnv(process.env),
  coachCompatibilityMs,
  coachSseHeartbeatMs,
  coachEnv,
  gmailEnabled = false,
  googleEnabled = false,
  googleClientId,
  googleClientSecret,
  resendApiKey,
  authEmailFrom,
  logAuthMail = logAuthMailFromEnv(process.env),
  interpretPostings = false,
  fetchJobPosting,
  commitSha,
  healthDbTimeoutMs = 2000,
  oauthClientLimits,
  oauthClientClock,
}: AppConfig) {
  const registry = installRegistry({
    ...(fetchJobPosting ? { fetch: fetchJobPosting } : {}),
    interpret: interpretPostings
      ? async ({ plan, text }) => {
          try {
            return await interpretPosting({ plan, text, env: coachEnv ?? {} })
          } catch {
            return null
          }
        }
      : null,
  })
  setCoachModelEnv(coachEnv ?? {})
  const app = new Hono()

  const globalBodyLimit = bodyLimit({ maxSize: 9_000_000 })
  app.use("/*", (c, next) =>
    c.req.path === "/api/paper/import" ? next() : globalBodyLimit(c, next)
  )

  app.use(
    "/*",
    cors({
      origin: (origin) => (isAllowedOrigin(webOrigins, origin) ? origin : null),
      credentials: true,
      allowHeaders: [
        "Content-Type",
        "Last-Event-ID",
        "Authorization",
        "MCP-Protocol-Version",
        "Mcp-Method",
        "Mcp-Name",
        "Mcp-Session-Id",
      ],
      exposeHeaders: [
        "Content-Disposition",
        "WWW-Authenticate",
        "MCP-Protocol-Version",
        "Retry-After",
        "X-Retry-After",
      ],
    })
  )

  const database = db as AppDatabase | undefined
  if (database) {
    app.use("*", async (_c, next) => withDatabase(database, () => next()))
  }

  app.onError(handleApiError)
  app.notFound(notFoundEnvelopeResponse)
  app.route(
    "/",
    createHealthRoutes({
      db: database,
      sha: commitSha ?? null,
      mailConfigured: authMailConfigured({
        resendApiKey,
        from: authEmailFrom,
        logOtp: logAuthMail,
      }),
      dbTimeoutMs: healthDbTimeoutMs,
    })
  )

  const auth =
    db && sessionSecret && authUrl
      ? createAuth({
          db,
          sessionSecret,
          authUrl,
          webOrigins,
          rateLimitEnabled,
          sendCodeLimitEnabled,
          resendApiKey,
          authEmailFrom,
          logAuthMail,
          googleClientId: googleEnabled ? googleClientId : undefined,
          googleClientSecret: googleEnabled ? googleClientSecret : undefined,
        })
      : undefined

  hostEmailChangeCode(emailChangeCodeFromRequest)
  const signedIn = requireSession(auth, database)
  app.use("*", async (_c, next) => {
    if (auth) await auth.$context
    await next()
  })
  if (auth && database && authUrl)
    app.route("/", connectionRoutes(auth, registry, authUrl, webOrigins))

  app.use("/api/auth/*", async (c, next) => {
    if (!isServedAuthPath(c.req.path)) return notFoundEnvelopeResponse(c)
    await next()
  })
  if (database && sessionSecret)
    app.use(
      "/api/auth/*",
      authEmailLimit({
        db: database,
        secret: sessionSecret,
        caps: authCodeSendWarningPerHour
          ? { sendWarningPerHour: authCodeSendWarningPerHour }
          : undefined,
        limitSends:
          rateLimitEnabled !== false && sendCodeLimitEnabled !== false,
      })
    )
  if (auth && database)
    app.use(
      "/api/auth/oauth2/*",
      oauthClientLimit({
        db: database,
        now: oauthClientClock,
        limits: oauthClientLimits,
      })
    )
  app.all("/api/auth/*", (c) =>
    auth
      ? handleAuthRequest(auth, c.req.raw)
      : c.json(authUnavailableEnvelope(), 503)
  )
  app.get("/api/public-config", (c) => {
    c.header("Cache-Control", "no-store")
    return c.json({ google: googleEnabled, coachDurable })
  })
  app.get("/api/session", currentSession(auth, database))

  const coachRoutes = createCoachRoutes({
    signedIn,
    coach,
    coachDurable,
    coachCompatibilityMs,
    coachSseHeartbeatMs,
  })

  app.route("/api/commands", createCommandRoutes({ signedIn, registry }))
  app.route("/api/reads", createReadRoutes({ signedIn, registry }))
  app.route("/api/coach/tasks", createCoachTaskRoutes({ signedIn }))
  app.route("/api/chats", coachRoutes)
  app.route("/api/paper", createPaperRoutes(signedIn))
  app.route("/api/inbox", createInboxRoutes(signedIn, gmailEnabled))
  app.route("/api/account", createAccountRoutes(signedIn))

  return app
}
