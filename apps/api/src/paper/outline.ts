import {
  paperOutline,
  type NativeWriter,
  type PaperId,
  type UserId,
} from "@workspace/domain"

import { packageFailure } from "./package-pages.js"
import { missingDocument, ownedPackageOutline } from "./package-list.js"
import { readStoredPaper } from "./read-paper.js"
import { basisOf } from "./native-admission.js"
import { ownedPaper } from "./store.js"

export const OUTLINE_MAX_CHARS = 12_000

export async function readOutline(
  userId: UserId,
  docId: PaperId,
  blockIds: readonly string[] | undefined,
  cursor?: string,
  writer?: NativeWriter
) {
  try {
    const row = await ownedPaper(userId, docId, writer)
    if (cursor)
      return packageFailure("This document does not have a next Word part.")
    const document = readStoredPaper(row)
    const nativeBasis = basisOf(
      document,
      row.crdtEpoch ?? 1,
      row.contentVersion
    )
    const outline = paperOutline(document, {
      selected: blockIds,
      maxChars: OUTLINE_MAX_CHARS,
    })
    return {
      revision: row.contentVersion,
      ...(nativeBasis ? { nativeBasis } : {}),
      outline: outline.text,
      truncated: outline.truncated,
    }
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
