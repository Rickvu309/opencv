import { ApiError, isErrorEnvelope } from "@/lib/api-error.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"
import { invalidateClientSession } from "@/lib/auth-client.ts"
import { signInHref } from "@/lib/auth-redirect.ts"

export { apiBaseUrl } from "@/lib/api-url.ts"
export { ApiError, isErrorEnvelope } from "@/lib/api-error.ts"

export async function fetchHealth(): Promise<{ ok: boolean }> {
  const res = await fetch(new URL("/health", apiBaseUrl))

  if (!res.ok) {
    throw new Error(`Health check failed with ${res.status}`)
  }

  return res.json()
}

type UnauthorizedHandler = () => void

function defaultOnUnauthorized() {
  invalidateClientSession()
  if (typeof window === "undefined") return

  const current = `${window.location.pathname}${window.location.search}`
  const next = signInHref(current)
  if (current === next || current.startsWith("/sign-in")) return
  window.location.assign(next)
}

let onUnauthorized: UnauthorizedHandler = defaultOnUnauthorized

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler
}

export function resetUnauthorizedHandler() {
  onUnauthorized = defaultOnUnauthorized
}

async function readErrorEnvelope(res: Response) {
  const body: unknown = await res
    .clone()
    .json()
    .catch(() => null)

  if (isErrorEnvelope(body)) return body.error
  return null
}

/**
 * Authed request against the API. Always sends cookies
 * (`credentials: include`) and maps the `{ ok: false, error }` envelope to
 * `ApiError`. A 401 invalidates the Better Auth session and sends the User
 * to sign-in.
 */
export async function apiRequest(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const res = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    credentials: "include",
    headers,
  })

  if (!res.ok) {
    const error = await readErrorEnvelope(res)
    const code = error?.code ?? "REQUEST_FAILED"
    const message = error?.message ?? `Request failed with ${res.status}`

    if (res.status === 401 || code === "UNAUTHORIZED") {
      onUnauthorized()
      throw new ApiError(401, code, message)
    }

    throw new ApiError(res.status, code, message)
  }

  return res
}

/**
 * Authed fetch against the API. Shared URL, credentials, and error handling
 * with `apiStream`.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await apiRequest(path, init)

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

/**
 * Authed streaming request. Same URL, credentials, and error envelope as
 * `apiFetch`; the caller reads `response.body` (SSE).
 */
export async function apiStream(
  path: string,
  init?: RequestInit
): Promise<Response> {
  return apiRequest(path, init)
}
