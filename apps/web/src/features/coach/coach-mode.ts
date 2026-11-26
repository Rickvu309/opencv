import type { CoachMode } from "@workspace/domain/coach"

export const COACH_MODE_LOCKED = "Needs a Pro plan. Free stays selected."

export const COACH_MODE_OPTIONS = [
  {
    id: "free" as const,
    label: "Free",
    helper: "Everyday Coach help with its own daily limit.",
  },
  {
    id: "light" as const,
    label: "Light",
    helper: "The same Coach, counted against a separate Light daily limit.",
  },
  {
    id: "max" as const,
    label: "Max",
    helper: "The same Coach, counted against a separate Max daily limit.",
  },
] as const satisfies readonly {
  id: CoachMode
  label: string
  helper: string
}[]

export function coachModeLabel(mode: CoachMode) {
  return (
    COACH_MODE_OPTIONS.find((option) => option.id === mode)?.label ?? "Free"
  )
}

export function coachModeHelper(mode: CoachMode) {
  return (
    COACH_MODE_OPTIONS.find((option) => option.id === mode)?.helper ??
    COACH_MODE_OPTIONS[0].helper
  )
}

export function coachModeAvailable(mode: CoachMode, plan: string | undefined) {
  return mode === "free" || plan === "pro"
}

const DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

export function coachResetLabel(resetsAt: string, now: Date) {
  const reset = new Date(resetsAt)
  if (Number.isNaN(reset.getTime())) return "later"
  const time = reset.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  })
  const days = Math.round((startOfDay(reset) - startOfDay(now)) / DAY)
  if (days <= 0) return `today at ${time}`
  if (days === 1) return `tomorrow at ${time}`
  const date = reset.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  return `${date} at ${time}`
}
