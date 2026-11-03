import { ERROR_CODES } from "@workspace/domain"
import type { ZodType } from "zod"

import { CommandError } from "./errors.js"

function zodMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input"
}

export function parseInput<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      zodMessage(parsed.error)
    )
  }
  return parsed.data
}
