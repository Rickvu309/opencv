export type CoachAccess = "auto" | "confirm" | "never"

export type VersionedResource = { field: string; holder: string }

export type ResourceRef = {
  name: string
  coachFloor: CoachAccess
  entityId?: string
  versioned?: VersionedResource
}

export type ResourceTouch = { ownerId: string; name: string; entityId?: string }

export function resourcesOverlap(
  touch: ResourceTouch,
  dependency: ResourceTouch
) {
  if (touch.ownerId !== dependency.ownerId) return false
  if (touch.name === "workspace" || dependency.name === "workspace") return true
  return (
    touch.name === dependency.name &&
    (touch.entityId === undefined ||
      dependency.entityId === undefined ||
      touch.entityId === dependency.entityId)
  )
}

export const jobPriorityResource = {
  name: "job.priority",
  coachFloor: "confirm",
  versioned: { field: "priority", holder: "job" },
} as const satisfies ResourceRef

export const paperLabelResource = {
  name: "paper.label",
  coachFloor: "never",
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
