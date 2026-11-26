import { errorEnvelope } from "@workspace/domain/kernel"
import { LIMITS, type LimitId, type LimitSpec } from "@workspace/domain/limits"

export type LimitRefusal = {
  limit: LimitId
  reach: "key" | "service"
  retryAfterSeconds: number
  message: string
}

export class Limited extends Error {
  readonly refusal: LimitRefusal
  constructor(refusal: LimitRefusal) {
    super(`limited:${refusal.limit}`)
    this.name = "Limited"
    this.refusal = refusal
  }
}

export function toRefusal(
  id: LimitId,
  spec: LimitSpec,
  denied: { reach: "key" | "service"; retryAt: number },
  now: number
): LimitRefusal {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((denied.retryAt - now) / 1000)
  )
  const message =
    denied.reach === "key"
      ? spec.says.key
      : (spec.says.service ?? spec.says.key)
  return { limit: id, reach: denied.reach, retryAfterSeconds, message }
}

function codeFor(id: LimitId, reach: "key" | "service") {
  if (id === "export.running")
    return reach === "key" ? "EXPORT_IN_PROGRESS" : "EXPORT_BUSY"
  return reach === "key" ? "LIMIT_REACHED" : "LIMIT_BUSY"
}

function limitResponse(
  status: number,
  code: string,
  message: string,
  retryAfterSeconds: number,
  id: LimitId
) {
  return new Response(JSON.stringify(errorEnvelope(code, message)), {
    status,
    headers: {
      "content-type": "application/json",
      "retry-after": String(retryAfterSeconds),
      "cache-control": "no-store",
      "x-limit": id,
    },
  })
}

export function refusalResponse(refusal: LimitRefusal) {
  const status = refusal.reach === "key" ? 429 : 503
  return limitResponse(
    status,
    codeFor(refusal.limit, refusal.reach),
    refusal.message,
    refusal.retryAfterSeconds,
    refusal.limit
  )
}

export function expiredResponse(id: LimitId) {
  const spec = LIMITS[id]
  return limitResponse(
    503,
    codeFor(id, "service"),
    spec.says.expired ?? spec.says.key,
    spec.retryAfterSeconds,
    id
  )
}
