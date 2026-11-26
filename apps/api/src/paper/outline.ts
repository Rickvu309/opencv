import {
  ERROR_CODES,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"

import { CommandError } from "../platform/errors.js"
import { richOutline } from "./rich-outline.js"
import { ownedPaperOrNull } from "./store.js"

export async function readOutline(
  userId: UserId,
  docId: PaperId,
  blockIds: readonly string[] | undefined
) {
  const row = await ownedPaperOrNull(userId, docId)
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  return richOutline(row, blockIds)
}
