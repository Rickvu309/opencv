import { paperOutline, type PaperId, type UserId } from "@workspace/domain"

import { mintedPackageOutline, missingDocument } from "./package-list.js"
import { readStoredPaper } from "./read-paper.js"
import { ownedPaper } from "./store.js"

export const OUTLINE_MAX_CHARS = 12_000

export async function readOutline(
  userId: UserId,
  docId: PaperId,
  blockIds: readonly string[] | undefined
) {
  try {
    const row = await ownedPaper(userId, docId)
    const outline = paperOutline(readStoredPaper(row), {
      selected: blockIds,
      maxChars: OUTLINE_MAX_CHARS,
    })
    return {
      revision: row.contentVersion,
      outline: outline.text,
      truncated: outline.truncated,
    }
  } catch (error) {
    if (!missingDocument(error)) throw error
    const minted = await mintedPackageOutline(
      userId,
      docId,
      blockIds,
      OUTLINE_MAX_CHARS
    )
    if (!minted) throw error
    return minted
  }
}
