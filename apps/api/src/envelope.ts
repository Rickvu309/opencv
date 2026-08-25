export type ErrorEnvelope = {
  ok: false
  error: {
    code: string
    message: string
  }
}

export function errorEnvelope(
  code: string,
  message: string
): ErrorEnvelope {
  return { ok: false, error: { code, message } }
}

export function unauthorizedEnvelope() {
  return errorEnvelope("UNAUTHORIZED", "Authentication required")
}

export function authUnavailableEnvelope() {
  return errorEnvelope("AUTH_UNAVAILABLE", "Authentication is not configured")
}
