import { ApiError } from "@/lib/api-error.ts"
import type { useRunCommand } from "@/lib/contract-client.ts"
import { ignoreRejection } from "@/lib/quiet-rejection.ts"

export const IMPORT_ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"

export function messageOf(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function discardCancelledImport(
  run: ReturnType<typeof useRunCommand>,
  docId: string
) {
  await ignoreRejection(
    run("paper.delete", { docId }),
    "cancelledImportCleanupStaysQuiet"
  )
}
