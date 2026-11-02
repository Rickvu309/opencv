const AUTH_BASE_PATH = "/api/auth"

export const WEB_CALLED_AUTH_PATHS = [
  "/get-session",
  "/sign-in/social",
  "/sign-out",
  "/email-otp/send-verification-otp",
  "/sign-in/email-otp",
  "/email-otp/change-email",
] as const

export const BROWSER_REDIRECT_AUTH_PATHS = ["/callback/:id"] as const

export const SERVED_AUTH_PATHS: readonly string[] = [
  ...WEB_CALLED_AUTH_PATHS,
  ...BROWSER_REDIRECT_AUTH_PATHS,
]

function decoded(pathname: string) {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

function normalizedPath(pathname: string) {
  return decoded(pathname).replace(/\/+/g, "/").replace(/\/$/, "").toLowerCase()
}

function matchesPattern(path: string, pattern: string) {
  const want = pattern.toLowerCase().split("/")
  const have = path.split("/")
  return (
    want.length === have.length &&
    want.every((part, index) => part.startsWith(":") || part === have[index])
  )
}

export function isServedAuthPath(pathname: string) {
  const path = normalizedPath(pathname)
  if (!path.startsWith(AUTH_BASE_PATH + "/")) return false
  const route = path.slice(AUTH_BASE_PATH.length)
  return SERVED_AUTH_PATHS.some((pattern) => matchesPattern(route, pattern))
}
