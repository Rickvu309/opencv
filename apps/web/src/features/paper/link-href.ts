import { isSafeHref } from "@workspace/domain"

const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/

export function normalizeHref(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = SCHEME.test(trimmed)
    ? trimmed
    : EMAIL.test(trimmed)
      ? `mailto:${trimmed}`
      : `https://${trimmed}`
  return isSafeHref(withScheme) ? withScheme : null
}
