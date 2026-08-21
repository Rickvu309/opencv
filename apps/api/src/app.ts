import { Hono } from "hono"
import { cors } from "hono/cors"

export type AppConfig = {
  /** Origins the browser may call this API from. */
  webOrigins: string[]
}

/**
 * Origin patterns allow a single `*`, which matches one DNS label — enough for
 * Vercel preview subdomains (`openpath-<build>-<scope>.vercel.app`) without
 * widening the match to every host under `vercel.app`.
 */
function matchesOrigin(pattern: string, origin: string) {
  const [prefix, suffix, ...rest] = pattern.split("*")
  if (rest.length > 0) return false
  if (suffix === undefined) return pattern === origin

  const middle = origin.slice(prefix.length, origin.length - suffix.length)
  return (
    origin.length >= prefix.length + suffix.length &&
    origin.startsWith(prefix) &&
    origin.endsWith(suffix) &&
    !middle.includes(".")
  )
}

export function createApp({ webOrigins }: AppConfig) {
  const app = new Hono()

  app.use(
    "/*",
    cors({
      origin: (origin) =>
        webOrigins.some((pattern) => matchesOrigin(pattern, origin))
          ? origin
          : null,
    })
  )

  app.get("/health", (c) => c.json({ ok: true }))

  return app
}
