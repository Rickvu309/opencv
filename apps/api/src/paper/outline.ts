import { paperOutline, type PaperId, type UserId } from "@workspace/domain"

import { missingDocument, ownedPackageOutline } from "./package-list.js"
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
    const page = await ownedPackageOutline(
      userId,
      docId,
      blockIds,
      OUTLINE_MAX_CHARS
    )
    if (!page) throw error
    return page
  }
}
