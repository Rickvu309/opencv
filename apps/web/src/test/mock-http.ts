import { apiBaseUrl } from "@/lib/api-url.ts"

export function isoNow() {
  return new Date().toISOString()
}

export function urlOf(input: RequestInfo | URL) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  return new URL(raw, apiBaseUrl)
}

export function pathOf(input: RequestInfo | URL) {
  return urlOf(input).pathname
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status })
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  detail?: { jobId?: string; stage?: string }
) {
  return Response.json(
    { ok: false, error: { code, message, ...detail } },
    { status }
  )
}
