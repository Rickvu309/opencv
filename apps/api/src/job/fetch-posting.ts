import {
  APPLY_SCAN_FETCH_FAILED,
  openableApplyJobUrl,
} from "@workspace/domain/apply"
import { lookup } from "node:dns/promises"
import { isIPv6 } from "node:net"

export type FetchJobPosting = (
  url: string
) => Promise<{ ok: true; text: string } | { ok: false; message: string }>

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

function ipv6Groups(address: string): number[] | null {
  const bare = address
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/%.*$/, "")
  if (!isIPv6(bare)) return null
  const tail = bare.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  const text = tail
    ? bare.slice(0, tail.index) +
      `${((Number(tail[1]) << 8) | Number(tail[2])).toString(16)}:` +
      ((Number(tail[3]) << 8) | Number(tail[4])).toString(16)
    : bare
  const [head = "", rest] = text.split("::")
  const left = head ? head.split(":") : []
  const right = rest ? rest.split(":") : []
  const zeros = rest === undefined ? 0 : 8 - left.length - right.length
  return [...left, ...Array(zeros).fill("0"), ...right].map((g) =>
    parseInt(g, 16)
  )
}

export function isPrivateIPv6(address: string): boolean {
  const g = ipv6Groups(address)
  if (!g) return false
  const [g0 = 0, , , , , g5 = 0, g6 = 0, g7 = 0] = g
  if (g.slice(0, 7).every((n) => n === 0)) return true
  if ((g0 & 0xffc0) === 0xfe80 || (g0 & 0xfe00) === 0xfc00) return true
  if (g.slice(0, 5).every((n) => n === 0) && (g5 === 0xffff || g5 === 0)) {
    return isPrivateIPv4(`${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`)
  }
  return false
}

export function isBlockedApplyScanHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "")
  if (!h) return true
  if (BLOCKED_HOSTS.has(h)) return true
  if (
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true
  }
  if (isPrivateIPv4(h) || isPrivateIPv6(h)) return true
  return false
}

function hostFromHttpUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase() || null
  } catch {
    return null
  }
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

async function readCappedText(response: Response): Promise<string | null> {
  const reader = response.body?.getReader()
  try {
    if (Number(response.headers.get("content-length")) > FETCH_MAX_BYTES) {
      await reader?.cancel()
      return null
    }
    if (!reader) return ""
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > FETCH_MAX_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(
      Buffer.concat(chunks)
    )
  } catch {
    return null
  }
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
            "User-Agent": "OpenCV/1.0 (Apply scan)",
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

      const text = await readCappedText(response)
      if (!text?.trim()) {
        return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
      }
      return { ok: true, text }
    }

    return { ok: false, message: APPLY_SCAN_FETCH_FAILED }
  }
}

export const fetchJobPosting = createFetchJobPosting()
