export type ErrorEnvelope = {
  ok: false
  error: {
    code: string
    message: string
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false
  if (!("ok" in value) || value.ok !== false) return false
  if (!("error" in value) || typeof value.error !== "object" || value.error === null) {
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
