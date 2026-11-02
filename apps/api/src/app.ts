import type { CoachRuntime } from "@workspace/domain"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { cors } from "hono/cors"

import {
  createAccountRoutes,
  createActivityRoutes,
  createBillingRoutes,
  createIntegrationsRoutes,
  createProfileRoutes,
  createSearchRoutes,
  createUsageRoutes,
} from "./account/index.js"
import { bindAuth, createAuth, type AuthDatabase } from "./auth.js"
import { createChatRoutes } from "./chat/index.js"
import { createCoachRoutes, interpretPosting } from "./coach/index.js"
import {
  logAuthMailFromEnv,
  setCoachModelEnv,
  type CoachModelEnv,
} from "./config.js"
import { withDatabase, type AppDatabase } from "./db/context.js"
import { authUnavailableEnvelope } from "./envelope.js"
import { createHealthRoutes } from "./health.js"
import { createInboxRoutes } from "./inbox/index.js"
import { createJobRoutes, type FetchJobPosting } from "./job/index.js"
import {
  handleApiError,
  notFoundEnvelopeResponse,
  requireSession,
} from "./middleware.js"
import { authMailConfigured } from "./mail/auth-code.js"
import { isAllowedOrigin } from "./origin.js"
import { createPaperRoutes } from "./paper/index.js"
import { createCommandRoutes } from "./registry/http.js"
import { installRegistry } from "./registry/install.js"

export type AppConfig = {
  webOrigins: string[]
  databaseUrl?: string
  sessionSecret?: string
  authUrl?: string
  db?: AuthDatabase
  rateLimitEnabled?: boolean
  sendCodeLimitEnabled?: boolean
  coach?: CoachRuntime
  coachSseHeartbeatMs?: number
  coachEnv?: CoachModelEnv
  gmailEnabled?: boolean
  googleEnabled?: boolean
  googleClientId?: string
  googleClientSecret?: string
  resendApiKey?: string
  authEmailFrom?: string
  logAuthMail?: boolean
  /** When set, job.preview may call the free model. Fake runs leave this off. */
  interpretPostings?: boolean
  fetchJobPosting?: FetchJobPosting
  /** Commit this process serves, from `RAILWAY_GIT_COMMIT_SHA`. */
  commitSha?: string
  healthDbTimeoutMs?: number
}

export function createApp({
  webOrigins,
  sessionSecret,
  authUrl,
  db,
  rateLimitEnabled,
  sendCodeLimitEnabled,
  coach,
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
      allowHeaders: ["Content-Type", "Authorization"],
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

  bindAuth(auth)

  app.all("/api/auth/*", (c) =>
    auth ? auth.handler(c.req.raw) : c.json(authUnavailableEnvelope(), 503)
  )
  app.get("/api/public-config", (c) =>
    c.json({
      google: googleEnabled,
    })
  )
  app.get("/api/session", requireSession(auth, database), (c) =>
    c.json({
      ok: true,
      user: c.var.session.user,
      session: c.var.session.session,
    })
  )

  const coachRoutes = createCoachRoutes({
    auth,
    db: database,
    coach,
    coachSseHeartbeatMs,
  })

  app.route(
    "/api/commands",
    createCommandRoutes({ auth, db: database, registry })
  )
  app.route("/api/chats", createChatRoutes(auth, database))
  app.route("/api/chats", coachRoutes)
  app.route("/api/coach", createUsageRoutes(auth, database))
  app.route("/api/paper", createPaperRoutes(auth, database))
  app.route("/api/jobs", createJobRoutes(auth, database))
  app.route("/api/inbox", createInboxRoutes(auth, database, gmailEnabled))
  app.route("/api/profile", createProfileRoutes(auth, database))
  app.route("/api/integrations", createIntegrationsRoutes(auth, database))
  app.route("/api/billing", createBillingRoutes(auth, database))
  app.route("/api/account", createAccountRoutes(auth, database))
  app.route("/api/search", createSearchRoutes(auth, database))
  app.route("/api/activity", createActivityRoutes(auth, database))

  return app
}
