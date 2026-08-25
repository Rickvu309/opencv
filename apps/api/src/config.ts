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

const localAuthUrl = "http://localhost:3001"

/**
 * Better Auth secret. Required to mount `/api/auth/*`. Unset/blank means auth
 * is not configured — `GET /health` must still serve 200.
 */
export function sessionSecretFromEnv(
  env: NodeJS.ProcessEnv
): string | undefined {
  const configured = env.SESSION_SECRET?.trim()
  return configured ? configured : undefined
}

/**
 * Public URL of this API, used as Better Auth `baseURL` and to choose cookie
 * attributes (https → SameSite=None; Secure). Falls back to the local api
 * when unset, matching `WEB_ORIGINS`.
 */
export function authUrlFromEnv(env: NodeJS.ProcessEnv): string {
  const configured = env.AUTH_URL?.trim()
  return configured ? configured : localAuthUrl
}
