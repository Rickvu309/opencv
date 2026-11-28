import {
  ERROR_CODES,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"

import { CommandError } from "../platform/errors.js"
import { enginePaperOrNull, readEngineOutline } from "./engine-paper.js"

export async function readOutline(
  userId: UserId,
  docId: PaperId,
  blockIds: readonly string[] | undefined
) {
  const row = await enginePaperOrNull(userId, docId)
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  return {
    name: row.name,
    kind: row.kind,
    status: row.status,
    ...(await readEngineOutline(docId, blockIds)),
  }
}
