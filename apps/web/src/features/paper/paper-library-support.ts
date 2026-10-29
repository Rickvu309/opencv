import { ApiError } from "@/lib/api-error.ts"

export const IMPORT_ACCEPT =
  ".pdf,.docx,.txt,.json,.pages,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json,application/vnd.apple.pages"

export function messageOf(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
