import { ApiError, isErrorEnvelope } from "@/lib/api-error.ts"
import { apiBaseUrl } from "@/lib/api-url.ts"
import { invalidateClientSession } from "@/lib/auth-client.ts"
import { SIGNED_OUT_EMAIL_KEY, signInHref } from "@/lib/auth-redirect.ts"
import { documentHref } from "@/lib/web-origins-env.ts"
import { busyServerWaitMs } from "@/lib/retry-after.ts"

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
type SessionExpiredListener = (email: string | null) => void

function readSignedOutEmail() {
  if (typeof sessionStorage === "undefined") return null
  return sessionStorage.getItem(SIGNED_OUT_EMAIL_KEY)
}

function assignSignIn() {
  if (typeof window === "undefined") return
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const next = signInHref(current)
  if (current === next || current.startsWith("/sign-in")) return
  window.location.assign(documentHref(next))
}

function defaultOnUnauthorized() {
  assignSignIn()
}

let onUnauthorized: UnauthorizedHandler = defaultOnUnauthorized
let sessionExpiredListener: SessionExpiredListener | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler
}

export function setSessionExpiredListener(
  listener: SessionExpiredListener | null
) {
  sessionExpiredListener = listener
}

export function resetUnauthorizedHandler() {
  onUnauthorized = defaultOnUnauthorized
  sessionExpiredListener = null
}

function notifyUnauthorized() {
  const email = readSignedOutEmail()
  invalidateClientSession()
  if (sessionExpiredListener) {
    sessionExpiredListener(email)
    return
  }
  onUnauthorized()
}

async function readErrorEnvelope(res: Response) {
  const body: unknown = await res
    .clone()
    .json()
    .catch(() => null)

  if (isErrorEnvelope(body)) return body.error
  return null
}

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

    const detail = {
      jobId: typeof error?.jobId === "string" ? error.jobId : undefined,
      stage: typeof error?.stage === "string" ? error.stage : undefined,
      retryAfterMs: busyServerWaitMs(
        res.status,
        res.headers.get("Retry-After"),
        Date.now()
      ),
    }
    if (res.status === 401 || code === "UNAUTHORIZED") {
      notifyUnauthorized()
      throw new ApiError(401, code, message, detail)
    }

    throw new ApiError(res.status, code, message, detail)
  }

  return res
}

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

export async function apiStream(
  path: string,
  init?: RequestInit
): Promise<Response> {
  return apiRequest(path, init)
}
