import { ApiError } from "@/lib/api-error.ts"
import type { useRunCommand } from "@/lib/contract-client.ts"
import { ignoreRejection } from "@/lib/quiet-rejection.ts"

import type { PaperView } from "@workspace/domain"

export const IMPORT_ACCEPT =
  ".pdf,.docx,.txt,.json,.pages,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json,application/vnd.apple.pages"

export function messageOf(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function discardImport(
  run: ReturnType<typeof useRunCommand>,
  created: PaperView
) {
  if (created.sourceFileId) {
    await ignoreRejection(
      run("paper.deleteFile", { fileId: created.sourceFileId }),
      "failedImportCleanupStaysQuiet"
    )
  }
  await ignoreRejection(
    run("paper.delete", { docId: created.id }),
    "failedImportCleanupStaysQuiet"
  )
}
