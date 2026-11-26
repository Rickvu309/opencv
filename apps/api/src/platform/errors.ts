import { httpStatusForError } from "@workspace/domain/kernel"

export class CommandError extends Error {
  readonly code: string
  readonly status: number
  readonly detail: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    detail: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = "CommandError"
    this.code = code
    this.status = httpStatusForError(code)
    this.detail = detail
  }
}

export function isMissingPhoto(error: unknown) {
  if (error instanceof CommandError) return false
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current)
    if ("code" in current && current.code === "P0002") return true
    const message =
      "message" in current && typeof current.message === "string"
        ? current.message
        : ""
    if (message.includes("Photo file not found")) return true
    current =
      "cause" in current ? (current as { cause?: unknown }).cause : undefined
  }
  return false
}

export function isUniqueViolation(error: unknown) {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current)
    if ("code" in current && current.code === "23505") return true
    current =
      "cause" in current ? (current as { cause?: unknown }).cause : undefined
  }
  const message = error instanceof Error ? error.message : ""
  return /duplicate key|unique constraint/i.test(message)
}
