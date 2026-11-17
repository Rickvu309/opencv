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
