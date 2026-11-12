const SECONDS = /^\d+$/

export function retryAfterMs(value: string | null, now: number): number | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (SECONDS.test(trimmed)) return Number(trimmed) * 1000
  if (!/[A-Za-z]/.test(trimmed)) return null
  const at = Date.parse(trimmed)
  if (Number.isNaN(at)) return null
  return Math.max(0, at - now)
}
