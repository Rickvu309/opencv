import type { CoachMode, CoachRuntime } from "@workspace/domain"
import { Hono } from "hono"
import { cors } from "hono/cors"

import { createAuth, type AuthDatabase } from "./auth.js"
import { createCoachRoutes } from "./coach/http.js"
import { commandRegistry } from "./commands/index.js"
import { createCommandRoutes } from "./commands/http.js"
import { authUnavailableEnvelope, unauthorizedEnvelope } from "./envelope.js"
import { isAllowedOrigin } from "./origin.js"
import { createApplyReadRoutes } from "./apply/http.js"
import type { FetchJobPosting } from "./apply/fetch-posting.js"
import { createPaperReadRoutes } from "./paper/http.js"
import { createPitchReadRoutes } from "./pitch/http.js"
import { createProfileReadRoutes } from "./profile/http.js"
import { createThreadReadRoutes } from "./threads/http.js"

export type AppConfig = {
  /** Origins the browser may call this API from. */
  webOrigins: string[]
  /**
   * Optional Postgres URL from `databaseUrlFromEnv`. Health never uses it;
   * constructing the app without this value must still serve `GET /health`.
   */
  databaseUrl?: string
  sessionSecret?: string
  authUrl?: string
  /** Injected Drizzle instance. Tests pass pglite; production passes `pg`. */
  db?: AuthDatabase
  rateLimitEnabled?: boolean
  /**
   * Optional Coach runtime (ADR-0007). Injected like `db` — the factory
   * never constructs one from env. Missing runtime → 503 on the coach route.
   */
  coach?: CoachRuntime
  /**
   * From `openRouterApiKeyFromEnv`. The factory never constructs a runtime;
   * `index.ts` wires OpenRouter via `coachRuntimeFromConfig` when this is set.
   */
  openRouterApiKey?: string
  /** @deprecated From `coachModelFromEnv`. New turns resolve via mode. */
  coachModel?: string
  /** From `coachDailyTurnLimitFromEnv` — global fallback when a mode cap is unset. */
  coachDailyTurnLimit?: number
  /** Per-mode OpenRouter model ids (ADR-0009). */
  coachModels?: Partial<Record<CoachMode, string>>
  /** Per-mode daily turn caps (ADR-0009). */
  coachDailyTurnLimits?: Partial<Record<CoachMode, number>>
  /** Test override; production uses `COACH_SSE_HEARTBEAT_MS` (15s). */
  coachSseHeartbeatMs?: number
  /** Test override for Apply URL scan fetch (QVE-218). */
  fetchJobPosting?: FetchJobPosting
}

export function createApp({
  webOrigins,
  sessionSecret,
  authUrl,
  db,
  rateLimitEnabled,
  coach,
  coachModel,
  coachDailyTurnLimit,
  coachModels,
  coachDailyTurnLimits,
  coachSseHeartbeatMs,
  fetchJobPosting,
}: AppConfig) {
  const app = new Hono()

  app.use(
    "/*",
    cors({
      origin: (origin) => (isAllowedOrigin(webOrigins, origin) ? origin : null),
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
    })
  )

  app.get("/health", (c) => c.json({ ok: true }))

  const auth =
    db && sessionSecret && authUrl
      ? createAuth({
          db,
          sessionSecret,
          authUrl,
          webOrigins,
          rateLimitEnabled,
        })
      : undefined

  if (auth) {
    app.all("/api/auth/*", (c) => auth.handler(c.req.raw))

    app.get("/api/session", async (c) => {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      })

      if (!session) {
        return c.json(unauthorizedEnvelope(), 401)
      }

      return c.json({ ok: true, user: session.user, session: session.session })
    })
  } else {
    app.all("/api/auth/*", (c) => c.json(authUnavailableEnvelope(), 503))
    app.get("/api/session", (c) => c.json(authUnavailableEnvelope(), 503))
  }

  app.route(
    "/api/commands",
    createCommandRoutes({ auth, db, registry: commandRegistry })
  )
  app.route("/api/threads", createThreadReadRoutes({ auth, db }))
  app.route(
    "/api/threads",
    createCoachRoutes({
      auth,
      db,
      registry: commandRegistry,
      coach,
      coachModel,
      coachDailyTurnLimit,
      coachModels,
      coachDailyTurnLimits,
      coachSseHeartbeatMs,
    })
  )
  app.route("/api/paper", createPaperReadRoutes({ auth, db }))
  app.route(
    "/api/apply",
    createApplyReadRoutes({ auth, db, coach, fetchJobPosting })
  )
  app.route("/api/profile", createProfileReadRoutes({ auth, db }))
  app.route("/api/pitch", createPitchReadRoutes({ auth, db }))

  return app
}
