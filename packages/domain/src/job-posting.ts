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

const UNRESOLVABLE_SEED_JOB_HOST = "jobs.example.com"

function prefixHttpsWhenSchemeless(raw: string): string {
  const trimmed = raw.trim()
  return HAS_URL_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
}

function applyJobUrlHost(candidate: string): string | null {
  const host = candidate.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? ""
  return host ? host.toLowerCase() : null
}

export function openableApplyJobUrl(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > APPLY_JOB_URL_MAX) return null
  const candidate = prefixHttpsWhenSchemeless(trimmed)
  if (candidate.length > APPLY_JOB_URL_MAX) return null
  if (!/^https?:\/\//i.test(candidate)) return null
  if (/\s/.test(candidate)) return null
  const host = applyJobUrlHost(candidate)
  if (!host || host === UNRESOLVABLE_SEED_JOB_HOST) return null
  return candidate
}
