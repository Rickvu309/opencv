import {
  interviewInstant,
  PROFILE_ZONE,
  zonedYmd,
} from "@/features/apply/apply-stages.ts"

type Parts = {
  year: string
  month: string
  day: string
  weekday: string
  hour: string
  minute: string
}

function parts(date: Date, zone: string): Parts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    formatted.find((part) => part.type === type)?.value ?? ""
  const hour = read("hour")
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    weekday: read("weekday"),
    hour: hour === "24" ? "00" : hour,
    minute: read("minute"),
  }
}

function dayNumber(part: Parts) {
  return Math.round(
    Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day)) /
      86400000
  )
}

function clock(part: Parts) {
  return `${Number(part.hour)}:${part.minute}`
}

const RECENT_DAYS = 3

export function inboxWhen(iso: string, now = new Date(), zone = PROFILE_ZONE) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const then = parts(date, zone)
  const ago = dayNumber(parts(now, zone)) - dayNumber(then)
  if (ago === 0) return clock(then)
  if (ago > 0 && ago <= RECENT_DAYS) return then.weekday
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: zone,
  }).format(date)
}

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`
}

function ago(then: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return plural(minutes, "minute")
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return plural(hours, "hour")
  const days = Math.floor(hours / 24)
  if (days < 60) return plural(days, "day")
  return plural(Math.floor(days / 30), "month")
}

export function inboxStamp(iso: string, now = new Date(), zone = PROFILE_ZONE) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const then = parts(date, zone)
  const monthDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: zone,
  }).format(date)
  const stamp = `${then.weekday}, ${monthDay}, ${clock(then)}`
  return date.getTime() > now.getTime() ? stamp : `${stamp} (${ago(date, now)})`
}

export function inboxChip(iso: string, zone = PROFILE_ZONE) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const then = parts(date, zone)
  return `${then.weekday} ${clock(then)}`
}

export function chipClock(iso: string, zone = PROFILE_ZONE) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return clock(parts(date, zone))
}

const SNOOZE_WAKE_HOUR = 7

export const SNOOZED_UNTIL_WAKE_TOAST = `Snoozed until ${SNOOZE_WAKE_HOUR}:00`

export function nextMorningIso(now = new Date(), zone = PROFILE_ZONE) {
  const today = parts(now, zone)
  let ymd = `${today.year}-${today.month}-${today.day}`
  if (Number(today.hour) >= SNOOZE_WAKE_HOUR) {
    const noon = interviewInstant(`${ymd}T12:00`, zone)
    const next = new Date(
      new Date(noon ?? now.toISOString()).getTime() + 24 * 60 * 60 * 1000
    )
    ymd = zonedYmd(next, zone)
  }
  return (
    interviewInstant(
      `${ymd}T${String(SNOOZE_WAKE_HOUR).padStart(2, "0")}:00`,
      zone
    ) ?? now.toISOString()
  )
}
