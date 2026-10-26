import { fileURLToPath } from "node:url"

import {
  resolveCoachDailyTurnLimit,
  resolveCoachModel,
  type CoachMode,
} from "@workspace/domain"

const localWebOrigin = "http://localhost:5173"

/**
 * Origins the API accepts browser calls from, as a comma-separated list. Each
 * entry is an exact origin or a single-`*` pattern (see `createApp`). Set per
 * Railway environment: production allows `https://opencv.me` (plus the old
 * Vercel origin during the overlap), staging allows `https://staging.opencv.me`.
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

/**
 * Local-only database driver. `pglite` runs the api on a file-backed PGlite
 * instead of Postgres; `index.ts` refuses it when `NODE_ENV=production`.
 */
export function dbDriverFromEnv(env: NodeJS.ProcessEnv): "pglite" | undefined {
  return env.DB_DRIVER?.trim() === "pglite" ? "pglite" : undefined
}

/** Data directory for the PGlite driver. Defaults to `apps/api/.data/default`. */
export function pgliteDataDirFromEnv(env: NodeJS.ProcessEnv): string {
  const configured = env.PGLITE_DATA_DIR?.trim()
  return configured
    ? configured
    : fileURLToPath(new URL("../.data/default", import.meta.url))
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
 * Local checks only: points the OpenRouter provider at a stub. Unset/blank
 * keeps the provider's own URL; anything but an http(s) URL is refused.
 */
export function openRouterBaseUrlFromEnv(
  env: NodeJS.ProcessEnv
): string | undefined {
  const configured = env.OPENROUTER_BASE_URL?.trim()
  if (!configured) return undefined
  if (!/^https?:\/\/\S+$/i.test(configured)) {
    throw new Error("OPENROUTER_BASE_URL must be an http(s) URL")
  }
  return configured
}

/** OpenRouter model id for a User-selected Coach mode (ADR-0009). */
export function coachModelForModeFromEnv(
  mode: CoachMode,
  env: NodeJS.ProcessEnv
): string {
  return resolveCoachModel(mode, env)
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

export type CoachModelEnv = {
  ANTHROPIC_API_KEY?: string
  OPENROUTER_API_KEY?: string
  COACH_MODEL_FREE?: string
  COACH_MODEL_PRO_FREE?: string
  COACH_MODEL_LIGHT?: string
  COACH_MODEL_MAX?: string
  COACH_DAILY_TURN_LIMIT_FREE?: string
  COACH_DAILY_TURN_LIMIT_LIGHT?: string
  COACH_DAILY_TURN_LIMIT_MAX?: string
  COACH_DAILY_TURN_LIMIT_PRO_FREE?: string
  COACH_SESSION_HOURS?: string
}

const coachEnvKeys = [
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "COACH_MODEL_FREE",
  "COACH_MODEL_PRO_FREE",
  "COACH_MODEL_LIGHT",
  "COACH_MODEL_MAX",
  "COACH_DAILY_TURN_LIMIT_FREE",
  "COACH_DAILY_TURN_LIMIT_LIGHT",
  "COACH_DAILY_TURN_LIMIT_MAX",
  "COACH_DAILY_TURN_LIMIT_PRO_FREE",
  "COACH_SESSION_HOURS",
] as const satisfies readonly (keyof CoachModelEnv)[]

/** Model and cap settings. Callers pass this object. They do not read the process env. */
export function coachModelEnvFromEnv(env: NodeJS.ProcessEnv): CoachModelEnv {
  const picked: CoachModelEnv = {}
  for (const key of coachEnvKeys) {
    const value = env[key]
    if (value !== undefined) picked[key] = value
  }
  return picked
}

let storedCoachModelEnv: CoachModelEnv = {}

export function setCoachModelEnv(env: CoachModelEnv) {
  storedCoachModelEnv = env
}

export function coachModelEnv(): CoachModelEnv {
  return storedCoachModelEnv
}

export function gmailEnabledFromEnv(env: NodeJS.ProcessEnv): boolean {
  return env.GMAIL_ENABLED === "true"
}

export function logAuthMailFromEnv(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV !== "production"
}

export function googleEnabledFromEnv(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()
  )
}
