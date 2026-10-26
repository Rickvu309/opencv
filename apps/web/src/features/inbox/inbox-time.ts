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

function weekKey(part: Parts) {
  const date = new Date(
    Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day))
  )
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return `${date.getUTCFullYear()}-${week}`
}

function clock(part: Parts) {
  return `${Number(part.hour)}:${part.minute}`
}

export function inboxWhen(iso: string, now = new Date(), zone = PROFILE_ZONE) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const then = parts(date, zone)
  const today = parts(now, zone)
  if (
    then.year === today.year &&
    then.month === today.month &&
    then.day === today.day
  ) {
    return clock(then)
  }
  if (weekKey(then) === weekKey(today)) return then.weekday
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: zone,
  }).format(date)
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

/** Next 07:00 in the profile zone. The toast copy stays "Snoozed until 7:00". */
export function nextMorningIso(now = new Date(), zone = PROFILE_ZONE) {
  const today = parts(now, zone)
  let ymd = `${today.year}-${today.month}-${today.day}`
  if (Number(today.hour) >= 7) {
    const noon = interviewInstant(`${ymd}T12:00`, zone)
    const next = new Date(
      new Date(noon ?? now.toISOString()).getTime() + 24 * 60 * 60 * 1000
    )
    ymd = zonedYmd(next, zone)
  }
  return interviewInstant(`${ymd}T07:00`, zone) ?? now.toISOString()
}

export function unreadCount(threads: { unread: boolean; status: string }[]) {
  return threads.filter((thread) => thread.unread && thread.status === "open")
    .length
}
