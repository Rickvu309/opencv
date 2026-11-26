import { type PaperId, type UserId } from "@workspace/domain/kernel"

import { packageFailure } from "./package-pages.js"
import { missingDocument, ownedPackageOutline } from "./package-list.js"
import { richOutline } from "./rich-outline.js"
import { ownedPaper, ownedPaperOrNull } from "./store.js"

export const OUTLINE_MAX_CHARS = 12_000

export async function readOutline(
  userId: UserId,
  docId: PaperId,
  blockIds: readonly string[] | undefined,
  cursor?: string
) {
  const row = await ownedPaperOrNull(userId, docId)
  if (row) {
    if (cursor)
      return packageFailure("This document does not have a next Word part.")
    return richOutline(row, blockIds)
  }
  try {
    if (cursor) {
      await ownedPaper(userId, docId)
      return packageFailure("This document does not have a next Word part.")
    }
    return await ownedPaper(userId, docId)
  } catch (error) {
    if (!missingDocument(error)) throw error
    const page = await ownedPackageOutline(
      userId,
      docId,
      blockIds,
      OUTLINE_MAX_CHARS,
      cursor
    )
    if (!page) throw error
    return page
  }
}
