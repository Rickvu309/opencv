import type { CoachAccess } from "./registry.js"

export type ResourceRef = { name: string; coachFloor: CoachAccess }

export const jobPriorityResource = {
  name: "job.priority",
  coachFloor: "confirm",
} as const satisfies ResourceRef

export function effectiveCoachPolicy<I>(
  entry: { coach: CoachAccess; writes?: (input: I) => ResourceRef[] },
  input: I
): CoachAccess {
  const policies = [
    entry.coach,
    ...(entry.writes?.(input) ?? []).map((resource) => resource.coachFloor),
  ]
  if (policies.includes("never")) return "never"
  if (policies.includes("confirm")) return "confirm"
  return "auto"
}
