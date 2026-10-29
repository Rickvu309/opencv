import { paperPhotoFileId, type PaperView } from "@workspace/domain"
import { and, eq, inArray, lt } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { files, paperDocs } from "../db/schema.js"
import { photoRefOf } from "./store.js"

/** An avatar row nothing references lives at most a day before the sweep removes it. */
const UNATTACHED_AVATAR_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * An avatar upload that never reached a document is abandoned. The web
 * deletes the row when it sees the flow fail; this sweep is the backstop
 * for the uploads a closed tab or a crash leaves behind.
 */
export async function sweepUnattachedPhotos(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - UNATTACHED_AVATAR_MAX_AGE_MS)
  const stale = await getDb()
    .select({ id: files.id, userId: files.userId })
    .from(files)
    .where(and(eq(files.purpose, "avatar"), lt(files.createdAt, cutoff)))
  const users = new Set(stale.map((row) => row.userId))
  const referenced = new Set<string>()
  for (const userId of users) {
    const docs = await getDb()
      .select({ document: paperDocs.document })
      .from(paperDocs)
      .where(eq(paperDocs.userId, userId))
    for (const doc of docs) {
      const fileId = paperPhotoFileId(
        photoRefOf(doc.document as PaperView["document"])
      )
      if (fileId) referenced.add(fileId)
    }
  }
  const unattached = stale
    .map((row) => row.id)
    .filter((id) => !referenced.has(id))
  if (unattached.length > 0) {
    await getDb()
      .delete(files)
      .where(and(eq(files.purpose, "avatar"), inArray(files.id, unattached)))
  }
  return unattached
}
