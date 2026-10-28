import { z } from "zod"

const APPLY_JOB_URL_MAX = 2000

export const applyStageSchema = z.enum([
  "inbox",
  "prep",
  "sent",
  "live",
  "closed",
])

const HAS_URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

export const APPLY_SCAN_FETCH_FAILED =
  "Couldn't read that posting. Paste the posting text and scan again."

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
