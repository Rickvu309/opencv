import type { JobView } from "@workspace/domain"

import { FAINT_TEXT } from "./apply-tone.ts"
import { PROFILE_ZONE, deadlineInstant, zonedYmd } from "./apply-stages.ts"

export const WEEKDAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const
export const FIRST_HOUR = 8
export const LAST_HOUR = 18
export const HOURS = Array.from(
  { length: LAST_HOUR - FIRST_HOUR + 1 },
  (_, index) => FIRST_HOUR + index
)
/** A job stores one interview start, so every interview block lasts this long. */
export const INTERVIEW_MINUTES = 60

export function addDays(ymd: string, days: number) {
  const date = deadlineInstant(ymd)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function addMonths(ymd: string, months: number) {
  const [year, month] = ymd.split("-").map(Number)
  const first = new Date(Date.UTC(year!, month! - 1 + months, 1, 12))
  return first.toISOString().slice(0, 10)
}

export function weekdayIndex(ymd: string) {
  const day = deadlineInstant(ymd).getUTCDay()
  return day === 0 ? 6 : day - 1
}

export function monthWeeks(anchor: string) {
  const first = `${anchor.slice(0, 7)}-01`
  const next = addMonths(first, 1)
  const length = Math.round(
    (deadlineInstant(next).getTime() - deadlineInstant(first).getTime()) /
      86_400_000
  )
  const start = addDays(first, -weekdayIndex(first))
  const weeks = Math.ceil((weekdayIndex(first) + length) / 7)
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day))
  )
}

export function weekDays(anchor: string) {
  const start = addDays(anchor, -weekdayIndex(anchor))
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/** The instant a calendar day starts in the profile zone. */
function dayStart(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number)
  const utc = Date.UTC(year!, month! - 1, day!)
  const local = (at: number) => {
    const [y, m, d] = zonedYmd(new Date(at)).split("-").map(Number)
    return Date.UTC(y!, m! - 1, d!, ...zonedClock(at))
  }
  let guess = utc
  for (let pass = 0; pass < 2; pass += 1) guess -= local(guess) - utc
  return new Date(guess)
}

function zonedClock(at: number): [number, number] {
  const minutes = minutesOfDay(new Date(at).toISOString())
  return [Math.floor(minutes / 60), minutes % 60]
}

export function rangeFor(days: string[]) {
  return {
    from: dayStart(days[0]!).toISOString(),
    to: dayStart(addDays(days.at(-1)!, 1)).toISOString(),
  }
}

export function dayName(ymd: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(deadlineInstant(ymd))
}

function longMonth(ymd: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(deadlineInstant(ymd))
}

function shortDay(ymd: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(deadlineInstant(ymd))
}

export function monthTitle(anchor: string) {
  return longMonth(anchor)
}

export function weekTitle(days: string[]) {
  const first = days[0]!
  const last = days.at(-1)!
  if (first.slice(0, 7) === last.slice(0, 7)) return longMonth(first)
  return `${shortDay(first)} to ${shortDay(last)}, ${last.slice(0, 4)}`
}

export type CalendarEvent = {
  key: string
  job: JobView
  kind: "deadline" | "interview"
  day: string
  startMinutes: number
  endMinutes: number
}

export function clock(minutes: number) {
  const hour = Math.floor(minutes / 60) % 24
  return `${hour}:${String(minutes % 60).padStart(2, "0")}`
}

function minutesOfDay(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PROFILE_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)
  return read("hour") * 60 + read("minute")
}

export function calendarEvents(jobs: JobView[]): CalendarEvent[] {
  return jobs.flatMap((job) => {
    const events: CalendarEvent[] = []
    if (job.deadline) {
      events.push({
        key: `${job.id}-deadline`,
        job,
        kind: "deadline",
        day: job.deadline,
        startMinutes: 0,
        endMinutes: 0,
      })
    }
    if (job.interviewAt) {
      const start = minutesOfDay(job.interviewAt)
      events.push({
        key: `${job.id}-interview`,
        job,
        kind: "interview",
        day: zonedYmd(new Date(job.interviewAt)),
        startMinutes: start,
        endMinutes: start + INTERVIEW_MINUTES,
      })
    }
    return events
  })
}

export function eventsInDays(events: CalendarEvent[], days: string[]) {
  const visibleDays = new Set(days)
  return events.filter((event) => visibleDays.has(event.day))
}

export function eventsOn(events: CalendarEvent[], day: string) {
  return events
    .filter((event) => event.day === day)
    .sort((a, b) => a.startMinutes - b.startMinutes)
}

export type Placed = { event: CalendarEvent; lane: number; lanes: number }

/** Interviews that overlap share the column side by side. */
export function placeInterviews(events: CalendarEvent[]): Placed[] {
  const placed: Placed[] = []
  let cluster: { event: CalendarEvent; lane: number }[] = []
  let laneEnds: number[] = []
  const flush = () => {
    for (const item of cluster) {
      placed.push({ ...item, lanes: laneEnds.length })
    }
    cluster = []
    laneEnds = []
  }
  for (const event of events) {
    if (cluster.length && event.startMinutes >= Math.max(...laneEnds)) flush()
    let lane = laneEnds.findIndex((end) => end <= event.startMinutes)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = event.endMinutes
    cluster.push({ event, lane })
  }
  flush()
  return placed
}

export const TONE = {
  label: FAINT_TEXT.card,
  faint: FAINT_TEXT.card,
  faintOnTint: FAINT_TEXT.background,
  number: "text-foreground/86",
} as const
