/**
 * Origin patterns allow a single `*`, which matches one DNS label — enough for
 * Vercel preview subdomains (`opencv-<build>-<scope>.vercel.app`) without
 * widening the match to every host under `vercel.app`.
 *
 * Shared by CORS and Better Auth `trustedOrigins` so CSRF and CORS use one
 * origin policy (ADR-0006).
 */
export function matchesOrigin(pattern: string, origin: string) {
  const [prefix, suffix, ...rest] = pattern.split("*")
  if (rest.length > 0) return false
  if (suffix === undefined) return pattern === origin

  const middle = origin.slice(prefix.length, origin.length - suffix.length)
  return (
    origin.length > prefix.length + suffix.length &&
    origin.startsWith(prefix) &&
    origin.endsWith(suffix) &&
    !middle.includes(".")
  )
}

export function isAllowedOrigin(webOrigins: string[], origin: string) {
  return webOrigins.some((pattern) => matchesOrigin(pattern, origin))
}
