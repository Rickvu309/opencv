import { APPLY_SCAN_FETCH_FAILED, openableApplyJobUrl } from "@workspace/domain"
import { lookup } from "node:dns/promises"

export type FetchJobPosting = (url: string) => Promise<
  { ok: true; text: string } | { ok: false; message: string }
>

export type JobPostingLookup = (host: string) => Promise<{
  address: string
  family: number
}>

const FETCH_TIMEOUT_MS = 8_000
const FETCH_MAX_BYTES = 512_000
const MAX_REDIRECTS = 4

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.internal",
])

export function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part))
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return false
  }
  const [a, b] = parts as [number, number, number, number]
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

export function isPrivateIPv6(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "")
  if (host === "::1") return true
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true
  }
  const mapped = host.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped?.[1] && isPrivateIPv4(mapped[1])) return true
  return false
}

export function isBlockedApplyScanHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "")
  if (!h) return true
  if (BLOCKED_HOSTS.has(h)) return true
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true
  }
  if (isPrivateIPv4(h) || isPrivateIPv6(h)) return true
  return false
}

function hostFromHttpUrl(url: string): string | null {
  const withoutScheme = url.replace(/^https?:\/\//i, "")
  const host = withoutScheme.split(/[/?#]/)[0] ?? ""
  return host ? host.toLowerCase() : null
}

export async function assertPublicApplyScanUrl(
  url: string,
  lookupImpl?: JobPostingLookup
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const openable = openableApplyJobUrl(url)
  if (!openable) {
    return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
  }
  const host = hostFromHttpUrl(openable)
  if (!host || isBlockedApplyScanHost(host)) {
    return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
  }
  if (lookupImpl) {
    try {
      const resolved = await lookupImpl(host)
      if (
        (resolved.family === 4 && isPrivateIPv4(resolved.address)) ||
        (resolved.family === 6 && isPrivateIPv6(resolved.address))
      ) {
        return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
      }
    } catch {
      return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
    }
  }
  return { ok: true, url: openable }
}

export function createFetchJobPosting(options?: {
  fetchImpl?: typeof fetch
  lookupImpl?: JobPostingLookup | null
}): FetchJobPosting {
  const fetchImpl = options?.fetchImpl ?? fetch
  const lookupImpl =
    options?.lookupImpl === undefined
      ? (host: string) => lookup(host)
      : options.lookupImpl

  return async function fetchJobPosting(url: string) {
    let current = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const allowed = await assertPublicApplyScanUrl(
        current,
        lookupImpl ?? undefined
      )
      if (!allowed.ok) return allowed

      let response: Response
      try {
        response = await fetchImpl(allowed.url, {
          method: "GET",
          redirect: "manual",
          headers: {
            Accept:
              "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
            "User-Agent": "OpenPath/1.0 (Apply scan)",
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
      } catch {
        return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) {
          return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
        }
        try {
          current = new URL(location, allowed.url).href
        } catch {
          return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
        }
        continue
      }

      if (!response.ok) {
        return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
      }

      const raw = await response.arrayBuffer()
      if (raw.byteLength > FETCH_MAX_BYTES) {
        return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
      }
      const text = new TextDecoder("utf-8", { fatal: false }).decode(raw)
      if (!text.trim()) {
        return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
      }
      return { ok: true, text }
    }

    return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
  }
}

export const fetchJobPosting = createFetchJobPosting()
