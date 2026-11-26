import type { JobView } from "@workspace/domain/apply"

import { FAINT_TEXT } from "./apply-tone.ts"
import { deadlineInstant, zonedYmd } from "./apply-stages.ts"

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
const LAST_CLOCK_HOUR = 23
export const HOURS = Array.from(
  { length: LAST_HOUR - FIRST_HOUR + 1 },
  (_, index) => FIRST_HOUR + index
)
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

function dayStart(ymd: string, zone: string) {
  const [year, month, day] = ymd.split("-").map(Number)
  const utc = Date.UTC(year!, month! - 1, day!)
  const local = (at: number) => {
    const [y, m, d] = zonedYmd(new Date(at), zone).split("-").map(Number)
    return Date.UTC(y!, m! - 1, d!, ...zonedClock(at, zone))
  }
  let guess = utc
  for (let pass = 0; pass < 2; pass += 1) guess -= local(guess) - utc
  return new Date(guess)
}

function zonedClock(at: number, zone: string): [number, number] {
  const minutes = minutesOfDay(new Date(at).toISOString(), zone)
  return [Math.floor(minutes / 60), minutes % 60]
}

export function rangeFor(days: string[], zone: string) {
  return {
    from: dayStart(days[0]!, zone).toISOString(),
    to: dayStart(addDays(days.at(-1)!, 1), zone).toISOString(),
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

function minutesOfDay(iso: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)
  return read("hour") * 60 + read("minute")
}

export function calendarEvents(jobs: JobView[], zone: string): CalendarEvent[] {
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
      const start = minutesOfDay(job.interviewAt, zone)
      events.push({
        key: `${job.id}-interview`,
        job,
        kind: "interview",
        day: zonedYmd(new Date(job.interviewAt), zone),
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

export function hoursFor(events: CalendarEvent[]) {
  const timed = events.filter((event) => event.kind === "interview")
  const first = Math.min(
    FIRST_HOUR,
    ...timed.map((event) => Math.floor(event.startMinutes / 60))
  )
  const last = Math.min(
    LAST_CLOCK_HOUR,
    Math.max(
      HOURS[HOURS.length - 1] ?? FIRST_HOUR,
      ...timed.map((event) => Math.ceil(event.endMinutes / 60))
    )
  )
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

export function blockSpan(event: CalendarEvent, hours: number[]) {
  const gridStart = (hours[0] ?? FIRST_HOUR) * 60
  const gridEnd = ((hours.at(-1) ?? LAST_HOUR) + 1) * 60
  return {
    top: event.startMinutes - gridStart,
    length: Math.min(event.endMinutes, gridEnd) - event.startMinutes,
  }
}

export type Placed = { event: CalendarEvent; lane: number; lanes: number }

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
