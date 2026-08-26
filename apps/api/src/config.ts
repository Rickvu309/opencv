import {
  DEFAULT_COACH_DAILY_TURN_LIMIT,
  resolveCoachDailyTurnLimit,
  resolveCoachModel,
  type CoachMode,
} from "@workspace/domain"

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

/**
 * OpenRouter key. Unset/blank means the Coach runtime cannot be constructed —
 * the app still boots; the coach route serves 503 `COACH_UNAVAILABLE`.
 */
export function openRouterApiKeyFromEnv(
  env: NodeJS.ProcessEnv
): string | undefined {
  const configured = env.OPENROUTER_API_KEY?.trim()
  return configured ? configured : undefined
}

/**
 * @deprecated Legacy single-model fallback when a turn has no mode.
 * New turns resolve via `resolveCoachModel(mode, env)`.
 */
export function coachModelFromEnv(env: NodeJS.ProcessEnv): string {
  return resolveCoachModel(undefined, env)
}

/** OpenRouter model id for a User-selected Coach mode (ADR-0009). */
export function coachModelForModeFromEnv(
  mode: CoachMode,
  env: NodeJS.ProcessEnv
): string {
  return resolveCoachModel(mode, env)
}

/**
 * Legacy global daily Coach turn cap. Unset, blank, or non-positive integers
 * fall back to 50 (ADR-0007). New turns use `coachDailyTurnLimitForModeFromEnv`.
 */
export function coachDailyTurnLimitFromEnv(env: NodeJS.ProcessEnv): number {
  const raw = env.COACH_DAILY_TURN_LIMIT?.trim()
  if (!raw) {
    return DEFAULT_COACH_DAILY_TURN_LIMIT
  }

  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_COACH_DAILY_TURN_LIMIT
  }

  return parsed
}

/** Per-mode daily turn cap (ADR-0009). */
export function coachDailyTurnLimitForModeFromEnv(
  mode: CoachMode,
  env: NodeJS.ProcessEnv
): number {
  return resolveCoachDailyTurnLimit(mode, env)
}

/**
 * Optional scripted runtime for local/dev (`curl -N` against the protocol).
 * `fake` wins over a present API key. Unset/anything else uses OpenRouter
 * when `OPENROUTER_API_KEY` is set, otherwise the coach route 503s.
 */
export function coachRuntimeModeFromEnv(
  env: NodeJS.ProcessEnv
): "fake" | undefined {
  const configured = env.COACH_RUNTIME?.trim()
  return configured === "fake" ? "fake" : undefined
}
