import { DEFAULT_COACH_MODE, type CoachMode } from "@workspace/domain"

export const COACH_MODE_OPTIONS = [
  {
    id: "free" as const,
    label: "Free",
    helper:
      "Zero-cost coaching on OpenRouter's free models. The model can change between turns. Daily turns are capped.",
  },
  {
    id: "light" as const,
    label: "Light",
    helper:
      "Stronger everyday coaching at low cost. Uses more of today's Light limit.",
  },
  {
    id: "max" as const,
    label: "Max",
    helper:
      "Highest quality for hard turns. The smallest daily cap of the three modes.",
  },
] as const satisfies readonly {
  id: CoachMode
  label: string
  helper: string
}[]

export const DEFAULT_HOME_COACH_MODE = DEFAULT_COACH_MODE

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
