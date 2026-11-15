import type { CoachMode } from "@workspace/domain"

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
