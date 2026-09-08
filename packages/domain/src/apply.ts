import { z } from "zod"

import { APPLY_COMMANDS } from "./commands.js"

export { generateKeyBetween } from "./apply-position.js"
export { APPLY_COMMANDS }

export const APPLY_TITLE_MAX = 200
export const APPLY_COMPANY_MAX = 200
export const APPLY_NOTE_MAX = 8000
export const APPLY_JOB_URL_MAX = 2000
export const DEFAULT_APPLY_TITLE = "Untitled role"
export const DEFAULT_APPLY_COMPANY = "Company"

export const applyStageSchema = z.enum([
  "inbox",
  "prep",
  "sent",
  "live",
  "closed",
])

export const applyTrackKindSchema = z.enum([
  "interview",
  "deadline",
  "followup",
  "applied",
])

export const applyCardIdSchema = z.string().uuid()

export const applyTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(APPLY_TITLE_MAX, "Title is too long")

export const applyCompanySchema = z
  .string()
  .trim()
  .min(1, "Company is required")
  .max(APPLY_COMPANY_MAX, "Company is too long")

export const applyNoteSchema = z
  .string()
  .max(APPLY_NOTE_MAX, "Note is too long")

export const applyJobUrlSchema = z
  .string()
  .trim()
  .max(APPLY_JOB_URL_MAX, "Job URL is too long")
  .nullable()

const HAS_URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

export const APPLY_JOB_URL_INVALID = "That posting link isn't a valid web URL."
export const APPLY_JOB_URL_BLOCKED = "The browser blocked opening this posting."

/** Prefix https:// when a café-student paste has no scheme. */
export function normalizeApplyJobUrl(raw: string): string {
  const trimmed = raw.trim()
  return HAS_URL_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** http(s) posting URL we can honestly open, or null. */
export function openableApplyJobUrl(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > APPLY_JOB_URL_MAX) return null
  const candidate = normalizeApplyJobUrl(trimmed)
  if (candidate.length > APPLY_JOB_URL_MAX) return null
  if (!/^https?:\/\//i.test(candidate)) return null
  if (/\s/.test(candidate)) return null
  const host = candidate.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? ""
  if (!host) return null
  return candidate
}

export function parseApplyJobUrlInput(
  raw: string
): { ok: true; jobUrl: string | null } | { ok: false; message: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, jobUrl: null }
  if (trimmed.length > APPLY_JOB_URL_MAX) {
    return { ok: false, message: "Job URL is too long" }
  }
  const jobUrl = openableApplyJobUrl(trimmed)
  if (!jobUrl) return { ok: false, message: APPLY_JOB_URL_INVALID }
  return { ok: true, jobUrl }
}

export const applyTrackDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Track date must be YYYY-MM-DD")

export const applyCreateCardInputSchema = z
  .object({
    title: applyTitleSchema.optional(),
    company: applyCompanySchema.optional(),
    note: applyNoteSchema.optional(),
    stage: applyStageSchema.optional(),
    jobUrl: applyJobUrlSchema.optional(),
    trackDate: applyTrackDateSchema.optional(),
    trackKind: applyTrackKindSchema.optional(),
    starred: z.boolean().optional(),
  })
  .strict()

export const applyUpdateCardInputSchema = z
  .object({
    cardId: applyCardIdSchema,
    title: applyTitleSchema.optional(),
    company: applyCompanySchema.optional(),
    note: applyNoteSchema.optional(),
    jobUrl: applyJobUrlSchema.optional(),
    trackDate: applyTrackDateSchema.optional(),
    trackKind: applyTrackKindSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined ||
      value.company !== undefined ||
      value.note !== undefined ||
      value.jobUrl !== undefined ||
      value.trackDate !== undefined ||
      value.trackKind !== undefined,
    { message: "At least one field is required" }
  )

export const applyMoveCardInputSchema = z
  .object({
    cardId: applyCardIdSchema,
    stage: applyStageSchema,
    beforeCardId: applyCardIdSchema.nullable().optional(),
  })
  .strict()

export const applyToggleStarInputSchema = z
  .object({
    cardId: applyCardIdSchema,
  })
  .strict()

export const applyDeleteCardInputSchema = z
  .object({
    cardId: applyCardIdSchema,
  })
  .strict()

export const applyListCardsInputSchema = z.object({}).strict()

export type ApplyStage = z.infer<typeof applyStageSchema>
export type ApplyTrackKind = z.infer<typeof applyTrackKindSchema>
export type ApplyCreateCardInput = z.infer<typeof applyCreateCardInputSchema>
export type ApplyUpdateCardInput = z.infer<typeof applyUpdateCardInputSchema>
export type ApplyMoveCardInput = z.infer<typeof applyMoveCardInputSchema>
export type ApplyToggleStarInput = z.infer<typeof applyToggleStarInputSchema>
export type ApplyDeleteCardInput = z.infer<typeof applyDeleteCardInputSchema>
export type ApplyListCardsInput = z.infer<typeof applyListCardsInputSchema>

export type ApplyCardDeleted = {
  id: string
}

/**
 * Public Apply card. `fit` is stored on the row and never appears here
 * (PRODUCT.md open question 1).
 */
export type ApplyCard = {
  id: string
  title: string
  company: string
  note: string
  stage: ApplyStage
  position: string
  starred: boolean
  jobUrl: string | null
  trackDate: string
  trackKind: ApplyTrackKind
  createdAt: string
  updatedAt: string
}
