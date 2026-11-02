import {
  ERROR_CODES,
  paperDocumentSchema,
  paperOutline,
  upgradeStoredPaper,
  type PaperDocument,
  type PaperId,
  type UserId,
} from "@workspace/domain"

import { CommandError } from "../registry/errors.js"
import { ownedPaper } from "./store.js"

export const OUTLINE_MAX_CHARS = 12_000

function currentPaper(row: Awaited<ReturnType<typeof ownedPaper>>) {
  const stored = paperDocumentSchema.safeParse(row.crdtDocument)
  if (stored.success) return stored.data as PaperDocument
  const upgraded = upgradeStoredPaper(row.kind, row.document)
  if (!upgraded.ok) {
    throw new CommandError(ERROR_CODES.CONFLICT, upgraded.message)
  }
  return upgraded.document
}

export async function readOutline(
  userId: UserId,
  docId: PaperId,
  blockIds: readonly string[] | undefined
) {
  const row = await ownedPaper(userId, docId)
  const outline = paperOutline(currentPaper(row), {
    selected: blockIds,
    maxChars: OUTLINE_MAX_CHARS,
  })
  return {
    revision: row.contentVersion,
    outline: outline.text,
    truncated: outline.truncated,
  }
}
