import { fileURLToPath } from "node:url"

import {
  resolveCoachDailyTurnLimit,
  localDevUrls,
  type CoachMode,
} from "@workspace/domain"

export function apiPortFromEnv(env: NodeJS.ProcessEnv): number {
  return localDevUrls(env.PORT).apiPort
}

export function webOriginsFromEnv(env: NodeJS.ProcessEnv): string[] {
  const configured = (env.WEB_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  return configured.length > 0 ? configured : [localDevUrls(env.PORT).webOrigin]
}

export function databaseUrlFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  const configured = env.DATABASE_URL?.trim()
  return configured ? configured : undefined
}

export function dbDriverFromEnv(env: NodeJS.ProcessEnv): "pglite" | undefined {
  return env.DB_DRIVER?.trim() === "pglite" ? "pglite" : undefined
}

export function pgliteDataDirFromEnv(env: NodeJS.ProcessEnv): string {
  const configured = env.PGLITE_DATA_DIR?.trim()
  return configured
    ? configured
    : fileURLToPath(new URL("../.data/default", import.meta.url))
}

export function sessionSecretFromEnv(
  env: NodeJS.ProcessEnv
): string | undefined {
  const configured = env.SESSION_SECRET?.trim()
  return configured ? configured : undefined
}

export function authUrlFromEnv(env: NodeJS.ProcessEnv): string {
  const configured = env.AUTH_URL?.trim()
  return configured ? configured : localDevUrls(env.PORT).apiUrl
}

export function coachDailyTurnLimitForModeFromEnv(
  mode: CoachMode,
  env: NodeJS.ProcessEnv
): number {
  return resolveCoachDailyTurnLimit(mode, env)
}

export function coachRuntimeModeFromEnv(
  env: NodeJS.ProcessEnv
): "fake" | undefined {
  const configured = env.COACH_RUNTIME?.trim()
  return configured === "fake" ? "fake" : undefined
}

export type CoachModelEnv = {
  ANTHROPIC_API_KEY?: string
  COACH_DAILY_TURN_LIMIT_FREE?: string
  COACH_DAILY_TURN_LIMIT_LIGHT?: string
  COACH_DAILY_TURN_LIMIT_MAX?: string
  COACH_DAILY_TURN_LIMIT_PRO_FREE?: string
  COACH_SESSION_HOURS?: string
}

const coachEnvKeys = [
  "ANTHROPIC_API_KEY",
  "COACH_DAILY_TURN_LIMIT_FREE",
  "COACH_DAILY_TURN_LIMIT_LIGHT",
  "COACH_DAILY_TURN_LIMIT_MAX",
  "COACH_DAILY_TURN_LIMIT_PRO_FREE",
  "COACH_SESSION_HOURS",
] as const satisfies readonly (keyof CoachModelEnv)[]

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
  if (env.NODE_ENV === "production") return false
  try {
    const url = new URL(authUrlFromEnv(env))
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  } catch {
    return false
  }
}

export function sendCodeLimitEnabledFromEnv(env: NodeJS.ProcessEnv): boolean {
  const localVerifyStack =
    env.NODE_ENV !== "production" &&
    dbDriverFromEnv(env) === "pglite" &&
    Boolean(env.OPENCV_VERIFY_RUN?.trim()) &&
    Boolean(env.AUTH_URL?.trim()) &&
    logAuthMailFromEnv(env)
  return !localVerifyStack
}

function presentEnv(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function resendApiKeyFromEnv(env: NodeJS.ProcessEnv) {
  return presentEnv(env.RESEND_API_KEY)
}

export function authEmailFromFromEnv(env: NodeJS.ProcessEnv) {
  return presentEnv(env.AUTH_EMAIL_FROM)
}

export function googleClientIdFromEnv(env: NodeJS.ProcessEnv) {
  return presentEnv(env.GOOGLE_CLIENT_ID)
}

export function googleClientSecretFromEnv(env: NodeJS.ProcessEnv) {
  return presentEnv(env.GOOGLE_CLIENT_SECRET)
}

export function googleEnabledFromEnv(env: NodeJS.ProcessEnv): boolean {
  return Boolean(googleClientIdFromEnv(env) && googleClientSecretFromEnv(env))
}

export function commitShaFromEnv(env: NodeJS.ProcessEnv) {
  return presentEnv(env.RAILWAY_GIT_COMMIT_SHA)
}
