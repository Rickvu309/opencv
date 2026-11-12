export type ErrorEnvelope = {
  ok: false
  error: {
    code: string
    message: string
    jobId?: string
    stage?: string
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly jobId?: string
  readonly stage?: string
  readonly retryAfterMs?: number

  constructor(
    status: number,
    code: string,
    message: string,
    detail?: { jobId?: string; stage?: string; retryAfterMs?: number }
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.jobId = detail?.jobId
    this.stage = detail?.stage
    this.retryAfterMs = detail?.retryAfterMs
  }
}

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false
  if (!("ok" in value) || value.ok !== false) return false
  if (
    !("error" in value) ||
    typeof value.error !== "object" ||
    value.error === null
  ) {
    return false
  }

  const error = value.error
  return (
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  )
}
