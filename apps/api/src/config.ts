const localWebOrigin = "http://localhost:5173"

/**
 * Origins the API accepts browser calls from, as a comma-separated list. Each
 * entry is an exact origin or a single-`*` pattern (see `createApp`). Set per
 * Railway environment: production allows the Vercel production origin, staging
 * allows the preview pattern.
 */
export function webOriginsFromEnv(env: NodeJS.ProcessEnv): string[] {
  const configured = (env.WEB_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  return configured.length > 0 ? configured : [localWebOrigin]
}

/**
 * Postgres connection string. Unset/blank means the process has no database —
 * `GET /health` must still serve 200. The app factory receives this value; it
 * never reads `process.env` itself.
 */
export function databaseUrlFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  const configured = env.DATABASE_URL?.trim()
  return configured ? configured : undefined
}
