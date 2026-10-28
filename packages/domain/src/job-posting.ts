import { z } from "zod"

const APPLY_JOB_URL_MAX = 2000
const APPLY_JD_TEXT_MAX = 20_000

export const applyStageSchema = z.enum([
  "inbox",
  "prep",
  "sent",
  "live",
  "closed",
])

const applyJobUrlSchema = z
  .string()
  .trim()
  .max(APPLY_JOB_URL_MAX, "Job URL is too long")
  .nullable()

const HAS_URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

const APPLY_JOB_URL_INVALID = "That posting link isn't a valid web URL."
export const APPLY_SCAN_EMPTY =
  "Paste a posting link or the posting text to scan."
export const APPLY_SCAN_FETCH_FAILED =
  "Couldn't read that posting. Paste the posting text and scan again."
export const APPLY_SCAN_NOT_FOUND =
  "Couldn't find a title or company in that post."
export const APPLY_SCAN_UNAVAILABLE =
  "Scan isn't available right now. Add the title and company yourself."

/**
 * Fake job-board host used by older Apply seeds. It NXDOMAINs.
 * Do not open it, persist it, or show Open job posting for it (QVE-217).
 */
const DEMO_APPLY_JOB_HOST = "jobs.example.com"

/** Prefix https:// when a café-student paste has no scheme. */
function normalizeApplyJobUrl(raw: string): string {
  const trimmed = raw.trim()
  return HAS_URL_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
}

function applyJobUrlHost(candidate: string): string | null {
  const host = candidate.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? ""
  return host ? host.toLowerCase() : null
}

/**
 * http(s) posting URL we can honestly open, or null.
 * Open it with a real `<a target="_blank" rel="noopener noreferrer">`.
 * Do not call `window.open(url, "_blank", "noopener,noreferrer")` — that
 * feature string makes the call return null even when the tab opened, which
 * Apply used to toast as blocked with no recovery (QVE-248).
 */
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

function parseApplyJobUrlInput(
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

const applyJdTextSchema = z
  .string()
  .max(APPLY_JD_TEXT_MAX, "Posting text is too long")

export const applyScanInputSchema = z
  .object({
    jobUrl: applyJobUrlSchema.optional(),
    jdText: applyJdTextSchema.optional(),
  })
  .strict()

type ApplyStage = z.infer<typeof applyStageSchema>
export type ApplyScanInput = z.infer<typeof applyScanInputSchema>
export type ApplyScanResult = {
  title: string | null
  company: string | null
  note: string | null
}

/**
 * Public Apply card. `fit` is stored on the row and never appears here
 * (PRODUCT.md open question 1). `demo` marks signup starter cards so they
 * never read as the User's own jobs (QVE-240).
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
  /** Signup sample. Omitted on cards the person added. */
  demo: boolean
  trackDate: string
  trackKind: "interview" | "deadline" | "followup" | "applied"
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
    return { ok: false, message: "Posting text is too long" }
  }
  const parsedUrl = parseApplyJobUrlInput(urlRaw)
  if (!parsedUrl.ok) return parsedUrl
  const jdText = jdRaw.trim() ? jdRaw.trim() : null
  if (!parsedUrl.jobUrl && !jdText) {
    return { ok: false, message: APPLY_SCAN_EMPTY }
  }
  return { ok: true, jobUrl: parsedUrl.jobUrl, jdText }
}

/** Collapse case, whitespace, and diacritics so a café paste still grounds. */
function foldApplyScanText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function applyScanFieldGrounded(
  source: string,
  value: string | null | undefined
): value is string {
  if (value == null) return false
  const needle = foldApplyScanText(value)
  if (needle.length < 2) return false
  return foldApplyScanText(source).includes(needle)
}

function emptyApplyScanField(value: string | null | undefined): string | null {
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
    title:
      applyScanFieldGrounded(source, title) &&
      !applyScanFieldLooksUnreadable(title)
        ? title
        : null,
    company: applyScanFieldGrounded(source, company) ? company : null,
    note:
      applyScanFieldGrounded(source, note) &&
      !applyScanFieldLooksUnreadable(note)
        ? note
        : null,
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

/**
 * Visible error-page chrome — not a job posting we can read (QVE-249).
 * Folded so “Page not found” / “PAGE NOT FOUND” match the same café paste.
 */
const UNREADABLE_APPLY_POSTING_PHRASES = [
  "page not found",
  "this page could not be found",
  "we can't find this page",
  "we couldn't find this page",
  "job not found",
  "this job is no longer available",
  "this posting is no longer available",
  "this job posting is no longer available",
  "404 not found",
  "error 404",
] as const

/** Fetched HTML (or its text) is an error shell, not a posting. */
export function isUnreadableApplyPosting(text: string): boolean {
  const folded = foldApplyScanText(text)
  if (!folded) return true
  return UNREADABLE_APPLY_POSTING_PHRASES.some((phrase) =>
    folded.includes(phrase)
  )
}

/** Extracted title/note is error-page chrome — never persist it as a fill. */
function applyScanFieldLooksUnreadable(
  value: string | null | undefined
): boolean {
  if (value == null) return false
  const folded = foldApplyScanText(value)
  if (!folded) return false
  return UNREADABLE_APPLY_POSTING_PHRASES.some(
    (phrase) => folded === phrase || folded.includes(phrase)
  )
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

const LABELED_FIELD_PATTERNS: {
  key: keyof ApplyScanResult
  pattern: RegExp
}[] = [
  {
    key: "title",
    pattern: /^(?:job\s+title|title|role|position)\s*[:\-–—]\s*(.+)$/iu,
  },
  {
    key: "company",
    pattern:
      /^(?:company(?:\s+name)?|employer|organisation|organization)\s*[:\-–—]\s*(.+)$/iu,
  },
  {
    key: "note",
    pattern: /^(?:location|deadline|apply\s+by)\s*[:\-–—]\s*(.+)$/iu,
  },
]

/**
 * Honest labeled extract — only `Label: value` lines already in the post.
 * Used so a clear café paste does not depend on a flaky Free model (QVE-232).
 */
export function extractApplyFieldsFromLabeledText(
  text: string
): ApplyScanResult {
  const result: ApplyScanResult = { title: null, company: null, note: null }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    for (const { key, pattern } of LABELED_FIELD_PATTERNS) {
      if (result[key]) continue
      const value = emptyApplyScanField(trimmed.match(pattern)?.[1])
      if (value) result[key] = value
    }
  }
  return result
}

/**
 * Honest hiring-prose extract — `X is hiring a Y in Z`.
 * Café recovery paste after an unread URL has no Label: lines (QVE-251).
 */
const HIRING_PROSE_PATTERN =
  /(?:^|[.!?]\s+)(.+?)\s+is hiring\s+(?:an?\s+)?(.+?)(?=\s+(?:in|at|to|for|who|that|which|apply)\b|[.,;!?]|$)/iu

const HIRING_LOCATION_PATTERN =
  /\bis hiring\b.+?\sin\s+(?!a\b|an\b|the\b)([^.,;!?]+)/iu

const APPLY_BY_PROSE_PATTERN = /\bapply by\s+([^.,;!?]+)/iu

const HIRING_COMPANY_REJECT = new Set([
  "we",
  "they",
  "i",
  "it",
  "this",
  "that",
  "our",
  "their",
  "someone",
  "anyone",
  "everyone",
])

function hiringFieldLooksUsable(
  value: string,
  kind: "title" | "company"
): boolean {
  const words = value.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 8) return false
  if (kind === "company") {
    const first = foldApplyScanText(words[0] ?? "")
    if (HIRING_COMPANY_REJECT.has(first)) return false
  }
  return true
}

export function extractApplyFieldsFromHiringText(
  text: string
): ApplyScanResult {
  const collapsed = text.replace(/\s+/g, " ").trim()
  if (!collapsed) return emptyApplyScanResult()

  const match = collapsed.match(HIRING_PROSE_PATTERN)
  const company = emptyApplyScanField(match?.[1])
  const title = emptyApplyScanField(match?.[2])
  const location = emptyApplyScanField(
    collapsed.match(HIRING_LOCATION_PATTERN)?.[1]
  )
  const applyBy = emptyApplyScanField(
    collapsed.match(APPLY_BY_PROSE_PATTERN)?.[1]
  )
  const note =
    location && location.split(/\s+/).length <= 4 ? location : applyBy

  return {
    title: title && hiringFieldLooksUsable(title, "title") ? title : null,
    company:
      company && hiringFieldLooksUsable(company, "company") ? company : null,
    note,
  }
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
