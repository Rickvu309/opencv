const SECONDS = /^\d+$/
const BUSY_STATUSES = new Set([429, 503])

export const BUSY_WAIT_DEFAULT_MS = 5_000
export const BUSY_WAIT_MIN_MS = 1_000
export const BUSY_WAIT_MAX_MS = 60_000

export function retryAfterMs(value: string | null, now: number): number | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (SECONDS.test(trimmed)) return Number(trimmed) * 1000
  if (!/[A-Za-z]/.test(trimmed)) return null
  const at = Date.parse(trimmed)
  if (Number.isNaN(at)) return null
  return Math.max(0, at - now)
}

export function retryAfterMinutes(
  value: string | null,
  now: number
): number | null {
  const ms = retryAfterMs(value, now)
  if (ms === null) return null
  return Math.max(1, Math.ceil(ms / 60_000))
}

export function captureRetryAfter() {
  let header: string | null = null
  return {
    fetchOptions: {
      onError(context: { response: Response }) {
        header =
          context.response.headers.get("Retry-After") ??
          context.response.headers.get("X-Retry-After")
      },
    },
    minutes: (now: number) => retryAfterMinutes(header, now),
  }
}

export function busyServerWaitMs(
  status: number,
  retryAfter: string | null,
  now: number
): number | undefined {
  if (!BUSY_STATUSES.has(status)) return undefined
  const asked = retryAfterMs(retryAfter, now) ?? BUSY_WAIT_DEFAULT_MS
  return Math.min(BUSY_WAIT_MAX_MS, Math.max(BUSY_WAIT_MIN_MS, asked))
}
