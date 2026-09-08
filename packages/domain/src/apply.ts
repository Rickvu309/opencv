import { z } from "zod"

import { APPLY_COMMANDS } from "./commands.js"

export { generateKeyBetween } from "./apply-position.js"
export { APPLY_COMMANDS }

export const APPLY_TITLE_MAX = 200
export const APPLY_COMPANY_MAX = 200
export const APPLY_NOTE_MAX = 8000
export const APPLY_JOB_URL_MAX = 2000
export const APPLY_JD_TEXT_MAX = 20_000
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
export const APPLY_SCAN_EMPTY =
  "Paste a posting link or the job text to scan."
export const APPLY_SCAN_FETCH_FAILED =
  "Couldn't read that posting. Paste the job text and scan again."
export const APPLY_SCAN_NOT_FOUND =
  "Couldn't find a title or company in that post."
export const APPLY_SCAN_UNAVAILABLE =
  "Scan isn't available right now. Add the title and company yourself."
export const APPLY_SCAN_SYSTEM_PROMPT = [
  "You extract a job title and company from a posting for OpenPath Apply.",
  "Return JSON only: {\"title\": string or null, \"company\": string or null, \"note\": string or null}",
  "Rules:",
  "- Use only words that appear in the posting. Do not invent or guess.",
  "- If the title or company is not clearly in the posting, use null.",
  "- note is an optional short hint copied from the posting (deadline, location, or a phrase a student might jot down). null if nothing useful is in the post. Do not paraphrase.",
  "- No extra keys, no markdown, no explanation.",
].join("\n")

/**
 * Fake job-board host used by older Apply seeds. It NXDOMAINs.
 * Do not open it, persist it, or show Open job posting for it (QVE-217).
 */
export const DEMO_APPLY_JOB_HOST = "jobs.example.com"

/** Prefix https:// when a café-student paste has no scheme. */
export function normalizeApplyJobUrl(raw: string): string {
  const trimmed = raw.trim()
  return HAS_URL_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
}

function applyJobUrlHost(candidate: string): string | null {
  const host = candidate.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? ""
  return host ? host.toLowerCase() : null
}

/** Older starter cards stored this dead host. Not a real posting. */
export function isDemoApplyJobUrl(raw: string | null | undefined): boolean {
  if (raw == null) return false
  const trimmed = raw.trim()
  if (!trimmed) return false
  const host = applyJobUrlHost(normalizeApplyJobUrl(trimmed))
  return host === DEMO_APPLY_JOB_HOST
}

/** Stored URL the product may show or open — never the demo seed host. */
export function publicApplyJobUrl(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed || isDemoApplyJobUrl(trimmed)) return null
  return trimmed
}

/** Quiet host for Source — empty when there is no openable posting. */
export function applyJobSourceHost(
  raw: string | null | undefined
): string | null {
  const href = openableApplyJobUrl(raw)
  if (!href) return null
  try {
    return new URL(href).hostname.replace(/^www\./i, "")
  } catch {
    return null
  }
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
  const host = applyJobUrlHost(candidate)
  if (!host || host === DEMO_APPLY_JOB_HOST) return null
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

export const applyJdTextSchema = z
  .string()
  .max(APPLY_JD_TEXT_MAX, "Job text is too long")

export const applyScanInputSchema = z
  .object({
    jobUrl: applyJobUrlSchema.optional(),
    jdText: applyJdTextSchema.optional(),
  })
  .strict()

export const applyScanResultSchema = z
  .object({
    title: z.string().trim().max(APPLY_TITLE_MAX).nullable(),
    company: z.string().trim().max(APPLY_COMPANY_MAX).nullable(),
    note: z.string().trim().max(APPLY_NOTE_MAX).nullable(),
  })
  .strict()

export type ApplyStage = z.infer<typeof applyStageSchema>
export type ApplyTrackKind = z.infer<typeof applyTrackKindSchema>
export type ApplyCreateCardInput = z.infer<typeof applyCreateCardInputSchema>
export type ApplyUpdateCardInput = z.infer<typeof applyUpdateCardInputSchema>
export type ApplyMoveCardInput = z.infer<typeof applyMoveCardInputSchema>
export type ApplyToggleStarInput = z.infer<typeof applyToggleStarInputSchema>
export type ApplyDeleteCardInput = z.infer<typeof applyDeleteCardInputSchema>
export type ApplyListCardsInput = z.infer<typeof applyListCardsInputSchema>
export type ApplyScanInput = z.infer<typeof applyScanInputSchema>
export type ApplyScanResult = z.infer<typeof applyScanResultSchema>

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

export function parseApplyScanInput(raw: {
  jobUrl?: string
  jdText?: string
}):
  | { ok: true; jobUrl: string | null; jdText: string | null }
  | { ok: false; message: string } {
  const urlRaw = raw.jobUrl ?? ""
  const jdRaw = raw.jdText ?? ""
  if (jdRaw.length > APPLY_JD_TEXT_MAX) {
    return { ok: false, message: "Job text is too long" }
  }
  const parsedUrl = parseApplyJobUrlInput(urlRaw)
  if (!parsedUrl.ok) return parsedUrl
  const jdText = jdRaw.trim() ? jdRaw.trim() : null
  if (!parsedUrl.jobUrl && !jdText) {
    return { ok: false, message: APPLY_SCAN_EMPTY }
  }
  return { ok: true, jobUrl: parsedUrl.jobUrl, jdText }
}

/** Collapse case and whitespace so a café paste still grounds. */
export function foldApplyScanText(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim()
}

export function applyScanFieldGrounded(
  source: string,
  value: string | null | undefined
): value is string {
  if (value == null) return false
  const needle = foldApplyScanText(value)
  if (needle.length < 2) return false
  return foldApplyScanText(source).includes(needle)
}

export function emptyApplyScanField(
  value: string | null | undefined
): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === "null") return null
  return trimmed
}

export function groundApplyScanResult(
  source: string,
  extracted: {
    title?: string | null
    company?: string | null
    note?: string | null
  }
): ApplyScanResult {
  const title = emptyApplyScanField(extracted.title)
  const company = emptyApplyScanField(extracted.company)
  const note = emptyApplyScanField(extracted.note)
  return {
    title: applyScanFieldGrounded(source, title) ? title : null,
    company: applyScanFieldGrounded(source, company) ? company : null,
    note: applyScanFieldGrounded(source, note) ? note : null,
  }
}

export function mergeApplyScanResults(
  ...results: ApplyScanResult[]
): ApplyScanResult {
  return {
    title: results.find((item) => item.title)?.title ?? null,
    company: results.find((item) => item.company)?.company ?? null,
    note: results.find((item) => item.note)?.note ?? null,
  }
}

export function applyScanHasIdentity(result: ApplyScanResult): boolean {
  return Boolean(result.title || result.company)
}

export function formatApplyScanReceipt(result: ApplyScanResult): string {
  if (result.title && result.company) {
    return `${result.title} at ${result.company}`
  }
  return result.title ?? result.company ?? ""
}

const applyScanModelFieldsSchema = z.object({
  title: z.union([z.string(), z.null()]).optional(),
  company: z.union([z.string(), z.null()]).optional(),
  note: z.union([z.string(), z.null()]).optional(),
})

/** Fail-closed parse of the model JSON. Junk or extra prose → empty fields. */
export function parseApplyScanModelText(raw: string): ApplyScanResult {
  const text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? text).trim()
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start === -1 || end <= start) {
    return { title: null, company: null, note: null }
  }
  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1))
    const fields = applyScanModelFieldsSchema.safeParse(parsed)
    if (!fields.success) return { title: null, company: null, note: null }
    return {
      title: emptyApplyScanField(fields.data.title ?? null),
      company: emptyApplyScanField(fields.data.company ?? null),
      note: emptyApplyScanField(fields.data.note ?? null),
    }
  } catch {
    return { title: null, company: null, note: null }
  }
}

export function postingTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function emptyApplyScanResult(): ApplyScanResult {
  return { title: null, company: null, note: null }
}

function jobPostingFromNode(node: unknown): ApplyScanResult {
  if (!node || typeof node !== "object") return emptyApplyScanResult()
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = jobPostingFromNode(item)
      if (applyScanHasIdentity(found)) return found
    }
    return emptyApplyScanResult()
  }

  const rec = node as Record<string, unknown>
  if (rec["@graph"]) {
    const fromGraph = jobPostingFromNode(rec["@graph"])
    if (applyScanHasIdentity(fromGraph)) return fromGraph
  }

  const types = [rec["@type"]]
    .flat()
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase())
  if (!types.includes("jobposting")) return emptyApplyScanResult()

  const title = emptyApplyScanField(
    typeof rec.title === "string" ? rec.title : null
  )
  const org = rec.hiringOrganization
  let company: string | null = null
  if (typeof org === "string") {
    company = emptyApplyScanField(org)
  } else if (org && typeof org === "object" && !Array.isArray(org)) {
    const name = (org as { name?: unknown }).name
    if (typeof name === "string") company = emptyApplyScanField(name)
  }
  return { title, company, note: null }
}

/** Honest structured extract — only JobPosting JSON-LD already in the post. */
export function extractApplyFieldsFromMarkup(html: string): ApplyScanResult {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )
  for (const block of blocks) {
    try {
      const found = jobPostingFromNode(JSON.parse(block[1] ?? ""))
      if (applyScanHasIdentity(found)) return found
    } catch {
      // Next JSON-LD block.
    }
  }
  return emptyApplyScanResult()
}
