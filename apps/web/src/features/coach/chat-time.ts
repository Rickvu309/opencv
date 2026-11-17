import { useReducer } from "react"

export type ChatAge = { short: string; long: string }

const UNITS = [
  { max: 60, size: 1, short: "m", long: "minute" },
  { max: 60 * 24, size: 60, short: "h", long: "hour" },
  { max: 60 * 24 * 7, size: 60 * 24, short: "d", long: "day" },
  { max: 60 * 24 * 30, size: 60 * 24 * 7, short: "w", long: "week" },
  { max: 60 * 24 * 365, size: 60 * 24 * 30, short: "mo", long: "month" },
  { max: Infinity, size: 60 * 24 * 365, short: "y", long: "year" },
] as const

export function chatAge(iso: string, now: number): ChatAge | null {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const minutes = Math.max(0, Math.floor((now - then) / 60000))
  if (minutes < 1) return { short: "now", long: "just now" }
  const unit = UNITS.find(({ max }) => minutes < max) ?? UNITS[UNITS.length - 1]
  const count = Math.max(1, Math.floor(minutes / unit.size))
  return {
    short: `${count}${unit.short}`,
    long: `${count} ${unit.long}${count === 1 ? "" : "s"} ago`,
  }
}

const DAY_MS = 86400000

function startOfDay(time: number) {
  const day = new Date(time)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

export function chatStartedLabel(iso: string, now: number): string | null {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const clock = then.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
  const days = Math.round(
    (startOfDay(now) - startOfDay(then.getTime())) / DAY_MS
  )
  if (days === 0) return `Today ${clock}`
  if (days === 1) return `Yesterday ${clock}`
  const sameYear = then.getFullYear() === new Date(now).getFullYear()
  const date = then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
  return `${date}, ${clock}`
}

const readNow = () => Date.now()
const keepFirst = (now: number) => now

export function useMountTime() {
  return useReducer(keepFirst, undefined, readNow)[0]
}
