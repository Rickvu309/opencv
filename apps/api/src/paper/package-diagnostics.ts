import {
  assertSurfaceKeys,
  opaqueTarget,
  refuseRenderMap,
  renderMap,
  RENDER_ASSOCIATION_REASONS,
  type AcknowledgedRevision,
  type RenderAssociationReason,
  type RenderMap,
} from "./package-render-map.js"

export const DIAGNOSTIC_STATUSES = ["unsupported", "unknown"] as const

export type DiagnosticStatus = (typeof DIAGNOSTIC_STATUSES)[number]

export type AssociationDiagnostic = {
  readonly subject: "association"
  readonly targetId: string
  readonly reason: RenderAssociationReason
  readonly status: DiagnosticStatus
}

type FontSource = {
  readonly subject: "font"
  readonly sourceFamily: string
  readonly sourceWeight: string
}

export type FontDiagnostic =
  | (FontSource & { readonly replacementFamily: string })
  | (FontSource & { readonly unavailableWeight: string })

export type StoryDiagnostic = {
  readonly subject: "story"
  readonly name: string
  readonly status: DiagnosticStatus
}

export type ShapeDiagnostic = {
  readonly subject: "shape"
  readonly name: string
  readonly status: DiagnosticStatus
}

export type DrawingBorder = {
  readonly width: string
  readonly color: string
}

export type DrawingDiagnostic = {
  readonly subject: "drawing"
  readonly name: string
  readonly border: DrawingBorder | null
}

export type PackageDiagnostic =
  | AssociationDiagnostic
  | FontDiagnostic
  | StoryDiagnostic
  | ShapeDiagnostic
  | DrawingDiagnostic

export type RenderAdapter = {
  readonly map: RenderMap
  readonly diagnostics: readonly PackageDiagnostic[]
}

const ASSOCIATION_KEYS = new Set(["subject", "targetId", "reason", "status"])
const FONT_KEYS = new Set([
  "subject",
  "sourceFamily",
  "sourceWeight",
  "replacementFamily",
  "unavailableWeight",
])
const GAP_KEYS = new Set(["subject", "name", "status"])
const DRAWING_KEYS = new Set(["subject", "name", "border"])
const BORDER_KEYS = new Set(["width", "color"])
const BORDER_SUBJECTS = new Set(["border", "outline", "image"])
const REASONS = new Set<string>(RENDER_ASSOCIATION_REASONS)
const STATUSES = new Set<string>(DIAGNOSTIC_STATUSES)
const PART_PATH =
  /^word\/(?:header\d+\.xml|footer\d+\.xml|media\/[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+)$/
const SHAPE_TOKEN = /^[A-Za-z][A-Za-z0-9]*$/
const WEIGHT_TOKEN = /^(?:[0-9]+|[A-Za-z][A-Za-z0-9-]*)$/
const SENTENCE_WORD =
  /\b(?:a|an|the|is|are|not|shown|warning|used|similar|available|stays|moved|here|with)\b/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function reasonOf(value: unknown): RenderAssociationReason {
  if (typeof value !== "string" || !REASONS.has(value))
    refuseRenderMap("closed-reason")
  return value as RenderAssociationReason
}

function statusOf(value: unknown): DiagnosticStatus {
  if (typeof value !== "string" || !STATUSES.has(value))
    refuseRenderMap("closed-status")
  return value as DiagnosticStatus
}

function present(value: unknown, code: "font-pair" | "unnamed-gap") {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value)
    refuseRenderMap(code)
  return value
}

function familyName(value: unknown) {
  const name = present(value, "font-pair")
  if (SENTENCE_WORD.test(name)) refuseRenderMap("ui-string")
  return name
}

function weightToken(value: unknown) {
  const weight = present(value, "font-pair")
  if (!WEIGHT_TOKEN.test(weight)) refuseRenderMap("ui-string")
  return weight
}

function partPath(value: unknown) {
  const name = present(value, "unnamed-gap")
  if (!PART_PATH.test(name)) refuseRenderMap("ui-string")
  return name
}

function shapeToken(value: unknown) {
  const name = present(value, "unnamed-gap")
  if (!SHAPE_TOKEN.test(name)) refuseRenderMap("ui-string")
  return name
}

function association(
  map: RenderMap,
  entry: Record<string, unknown>
): AssociationDiagnostic {
  assertSurfaceKeys(entry, ASSOCIATION_KEYS)
  if (!opaqueTarget(entry.targetId)) refuseRenderMap("new-target")
  if (!map.targets.includes(entry.targetId)) refuseRenderMap("foreign-target")
  return Object.freeze({
    subject: "association",
    targetId: entry.targetId,
    reason: reasonOf(entry.reason),
    status: statusOf(entry.status),
  })
}

function font(entry: Record<string, unknown>): FontDiagnostic {
  assertSurfaceKeys(entry, FONT_KEYS)
  const sourceFamily = familyName(entry.sourceFamily)
  const sourceWeight = weightToken(entry.sourceWeight)
  const hasReplacement = entry.replacementFamily !== undefined
  const hasUnavailable = entry.unavailableWeight !== undefined
  if (hasReplacement === hasUnavailable) refuseRenderMap("font-pair")
  if (hasReplacement) {
    return Object.freeze({
      subject: "font",
      sourceFamily,
      sourceWeight,
      replacementFamily: familyName(entry.replacementFamily),
    })
  }
  return Object.freeze({
    subject: "font",
    sourceFamily,
    sourceWeight,
    unavailableWeight: weightToken(entry.unavailableWeight),
  })
}

function gap(
  subject: "story" | "shape",
  entry: Record<string, unknown>
): StoryDiagnostic | ShapeDiagnostic {
  assertSurfaceKeys(entry, GAP_KEYS)
  return Object.freeze({
    subject,
    name: subject === "story" ? partPath(entry.name) : shapeToken(entry.name),
    status: statusOf(entry.status),
  })
}

function drawingBorder(value: unknown): DrawingBorder | null {
  if (value === null) return null
  if (!isRecord(value)) refuseRenderMap("border-off-drawing")
  assertSurfaceKeys(value, BORDER_KEYS)
  const width = value.width
  const color = value.color
  if (typeof width !== "string" || width.length === 0)
    refuseRenderMap("border-off-drawing")
  if (typeof color !== "string" || color.length === 0)
    refuseRenderMap("border-off-drawing")
  if (!/^[0-9]+$/.test(width) || !/^[0-9A-Fa-f]{6}$/.test(color))
    refuseRenderMap("ui-string")
  return Object.freeze({ width, color })
}

function drawing(entry: Record<string, unknown>): DrawingDiagnostic {
  assertSurfaceKeys(entry, DRAWING_KEYS)
  if (!("border" in entry)) refuseRenderMap("border-off-drawing")
  return Object.freeze({
    subject: "drawing",
    name: partPath(entry.name),
    border: drawingBorder(entry.border),
  })
}

function one(
  map: RenderMap,
  entry: Record<string, unknown>
): PackageDiagnostic {
  if (entry.subject === "association") return association(map, entry)
  if (entry.subject === "font") return font(entry)
  if (entry.subject === "story") return gap("story", entry)
  if (entry.subject === "shape") return gap("shape", entry)
  if (entry.subject === "drawing") return drawing(entry)
  if (typeof entry.subject === "string" && BORDER_SUBJECTS.has(entry.subject))
    refuseRenderMap("border-off-drawing")
  refuseRenderMap("second-map")
}

export function packageDiagnostics(
  map: RenderMap,
  entries: readonly Record<string, unknown>[]
): readonly PackageDiagnostic[] {
  const pinned = renderMap(map)
  if (!Array.isArray(entries)) refuseRenderMap("second-map")
  return Object.freeze(
    entries.map((entry) => {
      if (!isRecord(entry)) refuseRenderMap("second-map")
      return one(pinned, entry)
    })
  )
}

export function renderAdapter(
  acknowledged: AcknowledgedRevision,
  entries: readonly Record<string, unknown>[]
): RenderAdapter {
  const map = renderMap(acknowledged)
  return Object.freeze({
    map,
    diagnostics: packageDiagnostics(map, entries),
  })
}
