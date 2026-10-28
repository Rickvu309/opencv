import type { CoachMode } from "./coach.js"

const DAY_START_HOUR = 7
const DEFAULT_SESSION_HOURS = 4
const DEFAULT_DAILY_TURN_LIMIT_FREE = 20
const DEFAULT_DAILY_TURN_LIMIT_LIGHT = 10
const DEFAULT_DAILY_TURN_LIMIT_MAX = 5
const DEFAULT_DAILY_TURN_LIMIT_PRO_FREE = 0

const ROUTED_MODEL_FREE = "openrouter/free"
const ROUTED_MODEL_PRO_FREE = "claude-haiku-5-5"
const ROUTED_MODEL_LIGHT = "claude-sonnet-5-5"
const ROUTED_MODEL_MAX = "claude-opus-5-5"

export type Plan = "free" | "pro"

type DailyLimitEnv = {
  COACH_DAILY_TURN_LIMIT_FREE?: string
  COACH_DAILY_TURN_LIMIT_LIGHT?: string
  COACH_DAILY_TURN_LIMIT_MAX?: string
  COACH_DAILY_TURN_LIMIT_PRO_FREE?: string
}

type ModelRouteEnv = {
  COACH_MODEL_FREE?: string
  COACH_MODEL_PRO_FREE?: string
  COACH_MODEL_LIGHT?: string
  COACH_MODEL_MAX?: string
}

type SessionHoursEnv = {
  COACH_SESSION_HOURS?: string
}

type CoachProviderName = "openrouter" | "anthropic"

type ModelRoute =
  | { ok: true; provider: CoachProviderName; modelId: string }
  | { ok: false; code: "PLAN_REQUIRED" }

type CappedPercent = {
  capped: true
  percent: number
  resetsAt: string
}

type UncappedWindow = {
  capped: false
  resetsAt: string
}

type DayUsage =
  | {
      capped: true
      used: number
      cap: number
      remaining: number
      resetsAt: string
    }
  | UncappedWindow

type UsageSnapshot = {
  plan: Plan
  mode: CoachMode
  session: CappedPercent | UncappedWindow
  day: DayUsage
  week: CappedPercent | UncappedWindow
}

type CalendarDate = { year: number; month: number; day: number }

type ZonedParts = CalendarDate & {
  hour: number
  minute: number
  second: number
  weekday: string
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function trimmed(value: string | undefined) {
  const next = value?.trim()
  return next ? next : undefined
}

function nonNegativeInt(value: string | undefined) {
  const raw = trimmed(value)
  if (!raw) return undefined
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) return undefined
  return parsed
}

export function planAllowsMode(plan: Plan, mode: CoachMode) {
  return !(plan === "free" && (mode === "light" || mode === "max"))
}

export function dailyTurnCap(
  plan: Plan,
  mode: CoachMode,
  env: DailyLimitEnv = {}
) {
  if (plan === "pro" && mode === "free") {
    return (
      nonNegativeInt(env.COACH_DAILY_TURN_LIMIT_PRO_FREE) ??
      DEFAULT_DAILY_TURN_LIMIT_PRO_FREE
    )
  }
  if (mode === "light") {
    return (
      nonNegativeInt(env.COACH_DAILY_TURN_LIMIT_LIGHT) ??
      DEFAULT_DAILY_TURN_LIMIT_LIGHT
    )
  }
  if (mode === "max") {
    return (
      nonNegativeInt(env.COACH_DAILY_TURN_LIMIT_MAX) ??
      DEFAULT_DAILY_TURN_LIMIT_MAX
    )
  }
  return (
    nonNegativeInt(env.COACH_DAILY_TURN_LIMIT_FREE) ??
    DEFAULT_DAILY_TURN_LIMIT_FREE
  )
}

export function sessionHours(env: SessionHoursEnv = {}) {
  const parsed = nonNegativeInt(env.COACH_SESSION_HOURS)
  if (parsed === undefined || parsed === 0) return DEFAULT_SESSION_HOURS
  return parsed
}

export function resolveModelRoute(
  plan: Plan,
  mode: CoachMode,
  env: ModelRouteEnv = {}
): ModelRoute {
  if (!planAllowsMode(plan, mode)) return { ok: false, code: "PLAN_REQUIRED" }
  if (plan === "free") {
    return {
      ok: true,
      provider: "openrouter",
      modelId: trimmed(env.COACH_MODEL_FREE) ?? ROUTED_MODEL_FREE,
    }
  }
  if (mode === "light") {
    return {
      ok: true,
      provider: "anthropic",
      modelId: trimmed(env.COACH_MODEL_LIGHT) ?? ROUTED_MODEL_LIGHT,
    }
  }
  if (mode === "max") {
    return {
      ok: true,
      provider: "anthropic",
      modelId: trimmed(env.COACH_MODEL_MAX) ?? ROUTED_MODEL_MAX,
    }
  }
  return {
    ok: true,
    provider: "anthropic",
    modelId: trimmed(env.COACH_MODEL_PRO_FREE) ?? ROUTED_MODEL_PRO_FREE,
  }
}

export function coachLimitMessage(plan: Plan, mode: CoachMode) {
  if (plan === "free" && mode === "free") {
    return "You've reached today's Free limit. Resets at 7:00. Pro has unlimited Coach chats."
  }
  const label = mode === "light" ? "Light" : mode === "max" ? "Max" : "Free"
  return `You've reached today's ${label} limit. Resets at 7:00.`
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(instant)
  const map: Record<string, string> = {}
  for (const part of formatted) {
    if (part.type !== "literal") map[part.type] = part.value
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: map.weekday ?? "Mon",
  }
}

function offsetMs(instant: Date, timeZone: string) {
  const parts = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return asUtc - instant.getTime()
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const first = guess - offsetMs(new Date(guess), timeZone)
  return new Date(guess - offsetMs(new Date(first), timeZone))
}

function addCalendarDays(date: CalendarDate, delta: number): CalendarDate {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + delta)
  )
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

export function dayWindow(now: Date, timeZone: string, hour = DAY_START_HOUR) {
  const parts = zonedParts(now, timeZone)
  const startDate =
    parts.hour < hour
      ? addCalendarDays(parts, -1)
      : { year: parts.year, month: parts.month, day: parts.day }
  const start = zonedTimeToUtc(
    startDate.year,
    startDate.month,
    startDate.day,
    hour,
    0,
    timeZone
  )
  const next = addCalendarDays(startDate, 1)
  const resetsAt = zonedTimeToUtc(
    next.year,
    next.month,
    next.day,
    hour,
    0,
    timeZone
  )
  return { start, resetsAt }
}

export function weekWindow(now: Date, timeZone: string, hour = DAY_START_HOUR) {
  const parts = zonedParts(now, timeZone)
  const weekday = WEEKDAY_INDEX[parts.weekday] ?? 1
  let daysFromMonday = (weekday + 6) % 7
  if (daysFromMonday === 0 && parts.hour < hour) daysFromMonday = 7
  const monday = addCalendarDays(parts, -daysFromMonday)
  const start = zonedTimeToUtc(
    monday.year,
    monday.month,
    monday.day,
    hour,
    0,
    timeZone
  )
  const next = addCalendarDays(monday, 7)
  const resetsAt = zonedTimeToUtc(
    next.year,
    next.month,
    next.day,
    hour,
    0,
    timeZone
  )
  return { start, resetsAt }
}

export function sessionWindow(
  now: Date,
  timeZone: string,
  hours = DEFAULT_SESSION_HOURS
) {
  const spanHours = hours > 0 ? hours : DEFAULT_SESSION_HOURS
  const span = spanHours * 60 * 60 * 1000
  const anchor = dayWindow(now, timeZone).start
  const index = Math.floor((now.getTime() - anchor.getTime()) / span)
  const start = new Date(anchor.getTime() + index * span)
  return { start, resetsAt: new Date(start.getTime() + span) }
}

function percentOf(used: number, cap: number) {
  if (cap <= 0) return 0
  return Math.min(100, Math.round((used / cap) * 100))
}

export function usageSnapshot(input: {
  plan: Plan
  mode: CoachMode
  timeZone: string
  now: Date
  sessionTurns: number
  dayTurns: number
  weekTurns: number
  cap: number
  sessionHours?: number
}): UsageSnapshot {
  const day = dayWindow(input.now, input.timeZone)
  const week = weekWindow(input.now, input.timeZone)
  const session = sessionWindow(
    input.now,
    input.timeZone,
    input.sessionHours ?? DEFAULT_SESSION_HOURS
  )
  if (input.cap <= 0) {
    return {
      plan: input.plan,
      mode: input.mode,
      session: { capped: false, resetsAt: session.resetsAt.toISOString() },
      day: { capped: false, resetsAt: day.resetsAt.toISOString() },
      week: { capped: false, resetsAt: week.resetsAt.toISOString() },
    }
  }
  const weekCap = input.cap * 7
  return {
    plan: input.plan,
    mode: input.mode,
    session: {
      capped: true,
      percent: percentOf(input.sessionTurns, input.cap),
      resetsAt: session.resetsAt.toISOString(),
    },
    day: {
      capped: true,
      used: input.dayTurns,
      cap: input.cap,
      remaining: Math.max(0, input.cap - input.dayTurns),
      resetsAt: day.resetsAt.toISOString(),
    },
    week: {
      capped: true,
      percent: percentOf(input.weekTurns, weekCap),
      resetsAt: week.resetsAt.toISOString(),
    },
  }
}
