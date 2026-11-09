const OPAQUE_TARGET = /^t_[a-f0-9]{64}$/
const MAP_KEYS = new Set(["revision", "profile", "targets"])
const OFFSET_KEYS = new Set(["offset", "outlineOffset", "px"])
const UI_KEYS = new Set(["message", "label", "warning", "sentence", "ui"])

export const RENDER_ASSOCIATION_REASONS = [
  "date-range",
  "location",
  "column",
  "heading-group",
  "greeting",
] as const

export type RenderAssociationReason =
  (typeof RENDER_ASSOCIATION_REASONS)[number]

export type RenderMapProblem =
  | "empty-revision"
  | "empty-profile"
  | "new-target"
  | "duplicate-target"
  | "offset"
  | "second-map"
  | "foreign-target"
  | "ui-string"
  | "font-pair"
  | "unnamed-gap"
  | "border-off-drawing"
  | "closed-reason"
  | "closed-status"

export class RenderMapRefusal extends Error {
  readonly code: RenderMapProblem

  constructor(code: RenderMapProblem) {
    super(code)
    this.name = "RenderMapRefusal"
    this.code = code
  }
}

export function refuseRenderMap(code: RenderMapProblem): never {
  throw new RenderMapRefusal(code)
}

export type AcknowledgedRevision = {
  readonly revision: string
  readonly profile: string
  readonly targets: readonly string[]
}

export type RenderMap = {
  readonly revision: string
  readonly profile: string
  readonly targets: readonly string[]
}

export function assertSurfaceKeys(value: object, allowed: ReadonlySet<string>) {
  for (const key of Object.keys(value)) {
    if (OFFSET_KEYS.has(key)) refuseRenderMap("offset")
    if (UI_KEYS.has(key)) refuseRenderMap("ui-string")
    if (!allowed.has(key)) refuseRenderMap("second-map")
  }
}

export function opaqueTarget(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_TARGET.test(value)
}

function keptId(value: unknown, code: "empty-revision" | "empty-profile") {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value)
    refuseRenderMap(code)
  return value
}

export function renderMap(acknowledged: AcknowledgedRevision): RenderMap {
  if (
    typeof acknowledged !== "object" ||
    acknowledged === null ||
    Array.isArray(acknowledged)
  )
    refuseRenderMap("second-map")
  assertSurfaceKeys(acknowledged, MAP_KEYS)
  const revision = keptId(acknowledged.revision, "empty-revision")
  const profile = keptId(acknowledged.profile, "empty-profile")
  if (!Array.isArray(acknowledged.targets)) refuseRenderMap("second-map")
  const targets: string[] = []
  const seen = new Set<string>()
  for (const target of acknowledged.targets) {
    if (!opaqueTarget(target)) refuseRenderMap("new-target")
    if (seen.has(target)) refuseRenderMap("duplicate-target")
    seen.add(target)
    targets.push(target)
  }
  return Object.freeze({
    revision,
    profile,
    targets: Object.freeze(targets),
  })
}
