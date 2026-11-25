import type { QueryClient } from "@tanstack/react-query"

import { ApiError } from "@/lib/api-error.ts"
import { catalogClient } from "@/lib/contract-client.ts"
import { ignoreRejection } from "@/lib/quiet-rejection.ts"

export const IMPORT_ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"

export const IMPORT_FAILED_SENTENCE =
  "Could not import that file. Try it again."
export const IMPORT_OFFLINE_SENTENCE =
  "Could not reach OpenCV. Check your connection, then try again."
const READER_OFF_CODE = "IMPORT_READER_OFF"

export function importRefusal(error: unknown) {
  if (error instanceof ApiError)
    return {
      message: error.message,
      waitAndRetry:
        error.status === 429 ||
        (error.status >= 500 && error.code !== READER_OFF_CODE),
    }
  if (error instanceof TypeError)
    return { message: IMPORT_OFFLINE_SENTENCE, waitAndRetry: true }
  return { message: IMPORT_FAILED_SENTENCE, waitAndRetry: true }
}

export function messageOf(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function discardCancelledImport(
  queryClient: QueryClient,
  docId: string
) {
  await ignoreRejection(
    catalogClient.run(queryClient, "paper.delete", { docId }),
    "cancelledImportCleanupStaysQuiet"
  )
}
