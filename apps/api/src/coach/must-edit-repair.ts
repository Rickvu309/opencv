import {
  INVALID_COMMAND_INPUT_COPY,
  PAPER_CONTENT_VERSION,
  decodePaperContent,
  humanizeCommandFailCopy,
  paperDocIdSchema,
  type CoachFocusDoc,
  type PaperContentKind,
} from "@workspace/domain"
import { z } from "zod"

export const MUST_EDIT_APPLY_FAILED_COPY = "Could not apply the rewrite."

export type RepairedPaperUpdateInput = {
  docId: string
  contentVersion: number
  content: unknown
}

/**
 * Provider-facing schema for paper_updateContent. Free models send string
 * versions, omit fields, or wrap the getDoc DTO — the Command schema stays
 * strict; repair runs before execute.
 *
 * Must be a real Zod / Standard Schema (`~standard`). AI SDK `asSchema`
 * otherwise calls `schema()` and throws "schema is not a function", which
 * hangs the Free must-edit turn (QVE-196).
 */
export const paperUpdateContentCoachInputSchema = z
  .object({
    docId: z.unknown().optional(),
    contentVersion: z.unknown().optional(),
    content: z.unknown().optional(),
  })
  .passthrough()

export function isRecoverableUpdateFailure(message: string): boolean {
  const text = message.replace(/\s+/g, " ").trim()
  if (!text) return true
  if (/unsupported content version/i.test(text)) return true
  if (/content version must be a positive integer/i.test(text)) return true
  if (humanizeCommandFailCopy(text) === INVALID_COMMAND_INPUT_COPY) return true
  return false
}

export function toolFailureMessage(outputOrError: unknown): string {
  if (outputOrError instanceof Error) return outputOrError.message
  if (typeof outputOrError === "string") return outputOrError
  if (!outputOrError || typeof outputOrError !== "object") return ""

  const row = outputOrError as {
    ok?: unknown
    error?: { message?: unknown }
    message?: unknown
  }
  if (row.ok === false && typeof row.error?.message === "string") {
    return row.error.message
  }
  if (typeof row.message === "string") return row.message
  return ""
}

export function isSuccessfulToolOutput(output: unknown): boolean {
  return Boolean(
    output &&
      typeof output === "object" &&
      (output as { ok?: unknown }).ok === true
  )
}

/**
 * Rebuild a Command-valid paper_updateContent input from a Free-model call.
 * Coerces contentVersion to the supported schema version, unwraps a nested
 * Paper DTO, strips unknown keys, and overlays onto the open document so a
 * partial body still applies.
 */
export function repairPaperUpdateInput(
  input: unknown,
  focusDoc?: CoachFocusDoc
): RepairedPaperUpdateInput | null {
  const row = isPlainObject(input) ? input : {}
  const docId = resolveDocId(row.docId, focusDoc)
  if (!docId) return null

  const kind = focusDoc?.kind
  const content = normalizeContent(row.content ?? row, kind, focusDoc)
  if (content === undefined) return null

  const contentVersion =
    focusDoc?.contentVersion &&
    focusDoc.contentVersion === PAPER_CONTENT_VERSION
      ? focusDoc.contentVersion
      : PAPER_CONTENT_VERSION

  if (kind) {
    const decoded = decodePaperContent(kind, PAPER_CONTENT_VERSION, content)
    if (!decoded.ok) return null
    return { docId, contentVersion, content: decoded.data }
  }

  return { docId, contentVersion, content }
}

function resolveDocId(
  raw: unknown,
  focusDoc?: CoachFocusDoc
): string | undefined {
  if (typeof raw === "string" && paperDocIdSchema.safeParse(raw).success) {
    return raw
  }
  return focusDoc?.id
}

function normalizeContent(
  raw: unknown,
  kind: PaperContentKind | undefined,
  focusDoc?: CoachFocusDoc
): unknown | undefined {
  const unwrapped = unwrapContent(raw)
  if (unwrapped === undefined) return undefined

  if (kind) {
    const decoded = decodePaperContent(kind, PAPER_CONTENT_VERSION, unwrapped)
    if (decoded.ok) return decoded.data

    const stripped = stripPaperContent(kind, unwrapped)
    const strippedDecoded = decodePaperContent(
      kind,
      PAPER_CONTENT_VERSION,
      stripped
    )
    if (strippedDecoded.ok) return strippedDecoded.data

    if (focusDoc) {
      const overlaySource = overlapsPaperShape(focusDoc.content, unwrapped)
        ? unwrapped
        : overlapsPaperShape(focusDoc.content, stripped)
          ? stripped
          : undefined
      if (overlaySource === undefined) return undefined

      const merged = overlayKnown(focusDoc.content, overlaySource)
      const mergedDecoded = decodePaperContent(
        kind,
        PAPER_CONTENT_VERSION,
        merged
      )
      if (mergedDecoded.ok) return mergedDecoded.data
    }

    return undefined
  }

  return unwrapped
}

function unwrapContent(raw: unknown): unknown {
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return undefined
    try {
      return unwrapContent(JSON.parse(trimmed) as unknown)
    } catch {
      return undefined
    }
  }

  if (!isPlainObject(raw)) return raw

  const nested = raw.content
  const looksLikeDoc =
    nested !== undefined &&
    (typeof raw.contentVersion === "number" ||
      typeof raw.contentVersion === "string" ||
      typeof raw.kind === "string" ||
      typeof raw.status === "string" ||
      typeof raw.id === "string")

  if (looksLikeDoc) return unwrapContent(nested)
  return raw
}

function stripPaperContent(kind: PaperContentKind, value: unknown): unknown {
  if (!isPlainObject(value)) return value
  if (kind === "letter") return pick(value, ["markdown"])
  if (kind === "proof") {
    const next = pick(value, ["viewMode", "title", "subtitle", "steps"])
    if (Array.isArray(value.steps)) {
      next.steps = value.steps.map((step) => stripProofStep(step))
    }
    return next
  }
  const next = pick(value, [
    "templateId",
    "name",
    "headline",
    "contact",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "languages",
    "photoUrl",
  ])
  if (isPlainObject(value.contact)) {
    next.contact = pick(value.contact, ["email", "phone", "location", "linkedin"])
  }
  if (Array.isArray(value.experience)) {
    next.experience = value.experience.map((role) => stripExperience(role))
  }
  if (Array.isArray(value.education)) {
    next.education = value.education.map((row) =>
      isPlainObject(row)
        ? pick(row, ["school", "degree", "period", "detail"])
        : row
    )
  }
  if (Array.isArray(value.skills)) {
    next.skills = value.skills.map((row) =>
      isPlainObject(row) ? pick(row, ["label", "items"]) : row
    )
  }
  if (Array.isArray(value.projects)) {
    next.projects = value.projects.map((row) =>
      isPlainObject(row) ? pick(row, ["name", "detail"]) : row
    )
  }
  return next
}

function stripExperience(role: unknown): unknown {
  if (!isPlainObject(role)) return role
  return pick(role, ["role", "company", "period", "location", "bullets"])
}

function stripProofStep(step: unknown): unknown {
  if (!isPlainObject(step)) return step
  return {
    ...pick(step, ["id", "type", "title", "body", "time", "date", "photos"]),
    photos: Array.isArray(step.photos)
      ? step.photos.map((photo) =>
          isPlainObject(photo) ? pick(photo, ["id", "url", "caption"]) : photo
        )
      : step.photos,
  }
}

function overlapsPaperShape(base: unknown, overlay: unknown): boolean {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return false
  return Object.keys(base).some(
    (key) => key in overlay && overlay[key] !== undefined
  )
}

function overlayKnown(base: unknown, overlay: unknown): unknown {
  if (overlay === undefined) return base
  if (Array.isArray(base) && Array.isArray(overlay)) {
    if (base.every((item) => typeof item === "string")) return overlay
    if (overlay.every((item) => typeof item === "string")) return overlay
    return overlay.map((item, index) => {
      const template = base[index] ?? base[0]
      return template === undefined ? item : overlayKnown(template, item)
    })
  }
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const result: Record<string, unknown> = { ...base }
    for (const key of Object.keys(base)) {
      if (key in overlay) {
        result[key] = overlayKnown(base[key], overlay[key])
      }
    }
    return result
  }
  return overlay
}

function pick(
  value: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in value) result[key] = value[key]
  }
  return result
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
