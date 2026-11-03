import { legacyAppPath } from "./product-paths.ts"

const AUTH_PATHS = new Set(["/sign-in", "/sign-up"])

export const SIGNED_OUT_EMAIL_KEY = "opencv.signedOutEmail"

export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const trimmed = value.trim()
  if (!trimmed.startsWith("/")) return undefined
  if (trimmed.startsWith("//")) return undefined
  if (trimmed.includes("://")) return undefined

  const path = legacyAppPath(trimmed) ?? trimmed
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return undefined
  }

  const pathname = path.split(/[?#]/, 1)[0] ?? path
  if (AUTH_PATHS.has(pathname)) return undefined
  if (pathname === "/" && !path.includes("?") && !path.includes("#")) {
    return undefined
  }

  return path
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateAuthSearch(search: Record<string, unknown>): {
  redirect?: string
  email?: string
  error?: "google"
} {
  const redirect = safeRedirectPath(search.redirect)
  const email =
    typeof search.email === "string" && EMAIL_PATTERN.test(search.email)
      ? search.email
      : undefined
  const error = search.error === "google" ? "google" : undefined
  return {
    ...(redirect ? { redirect } : {}),
    ...(email ? { email } : {}),
    ...(error ? { error } : {}),
  }
}

export function isAuthPath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0] ?? path
  return AUTH_PATHS.has(pathname)
}

export function redirectFromSearch(search: unknown): string | undefined {
  if (typeof search !== "object" || search === null) return undefined
  if (!("redirect" in search)) return undefined
  return safeRedirectPath(search.redirect)
}

export function signInHref(currentPath: string): string {
  if (isAuthPath(currentPath)) return "/sign-in"

  const redirect = safeRedirectPath(currentPath)
  if (!redirect) return "/sign-in"

  return `/sign-in?redirect=${encodeURIComponent(redirect)}`
}
