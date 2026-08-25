import { Hono } from "hono"
import { cors } from "hono/cors"

import { createAuth, type AuthDatabase } from "./auth.js"
import {
  authUnavailableEnvelope,
  unauthorizedEnvelope,
} from "./envelope.js"
import { isAllowedOrigin } from "./origin.js"

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
}

export function createApp({
  webOrigins,
  sessionSecret,
  authUrl,
  db,
  rateLimitEnabled,
}: AppConfig) {
  const app = new Hono()

  app.use(
    "/*",
    cors({
      origin: (origin) =>
        isAllowedOrigin(webOrigins, origin) ? origin : null,
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

  return app
}
