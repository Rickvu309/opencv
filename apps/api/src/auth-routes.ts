const AUTH_BASE_PATH = "/api/auth"

export const BLOCKED_AUTH_PATHS = ["/email-otp/check-verification-otp"] as const

export const SERVED_OTP_PATHS = [
  "/email-otp/send-verification-otp",
  "/sign-in/email-otp",
  "/email-otp/verify-email",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
] as const

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

export function isBlockedAuthPath(pathname: string) {
  const path = normalizedPath(pathname)
  return BLOCKED_AUTH_PATHS.some((blocked) => path === AUTH_BASE_PATH + blocked)
}
