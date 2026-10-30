import { ApiError } from "@/lib/api-error.ts"
import type { useRunCommand } from "@/lib/contract-client.ts"

import type { PaperView } from "./paper-api.ts"

export const IMPORT_ACCEPT =
  ".pdf,.docx,.txt,.json,.pages,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json,application/vnd.apple.pages"

export function messageOf(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Removes a half-made import. The import error is already shown, so a failed cleanup stays quiet. */
export async function discardImport(
  run: ReturnType<typeof useRunCommand>,
  created: PaperView
) {
  if (created.sourceFileId) {
    // rejected-ok: best effort cleanup after a failed import.
    await run("paper.deleteFile", { fileId: created.sourceFileId }).catch(
      () => undefined
    )
  }
  // rejected-ok: best effort cleanup after a failed import.
  await run("paper.delete", { docId: created.id }).catch(() => undefined)
}
