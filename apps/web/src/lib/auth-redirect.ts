const AUTH_PATHS = new Set(["/sign-in", "/sign-up"])

/**
 * Only in-app paths. Rejects protocol-relative and auth-screen loops so a
 * crafted `?redirect=` cannot send the User off-origin.
 */
export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined

  const path = value.trim()
  if (!path.startsWith("/")) return undefined
  if (path.startsWith("//")) return undefined
  if (path.includes("://")) return undefined

  const pathname = path.split(/[?#]/, 1)[0] ?? path
  if (AUTH_PATHS.has(pathname)) return undefined

  return path
}

export function validateAuthSearch(search: Record<string, unknown>): {
  redirect?: string
} {
  const redirect = safeRedirectPath(search.redirect)
  return redirect ? { redirect } : {}
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
  if (!redirect || redirect === "/app") return "/sign-in"

  return `/sign-in?redirect=${encodeURIComponent(redirect)}`
}
