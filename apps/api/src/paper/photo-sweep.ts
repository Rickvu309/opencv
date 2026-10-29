import { paperPhotoFileId, storedPaperDocumentSchema } from "@workspace/domain"
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity, files, paperDocs, user } from "../db/schema.js"
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
      .select({ document: sql<unknown>`${paperDocs.document}`.as("document") })
      .from(paperDocs)
      .where(eq(paperDocs.userId, userId))
      .unionAll(
        getDb()
          .select({
            document: sql<unknown>`${activity.reversalInput}->'document'`.as(
              "document"
            ),
          })
          .from(activity)
          .innerJoin(
            paperDocs,
            and(
              eq(paperDocs.userId, activity.userId),
              sql`${paperDocs.id}::text = ${activity.reversalInput}->>'docId'`
            )
          )
          .where(
            and(
              eq(activity.userId, userId),
              eq(activity.reversalCommand, "paper.replace"),
              isNull(activity.undoneAt)
            )
          )
      )
    for (const doc of docs) {
      const parsed = storedPaperDocumentSchema.safeParse(doc.document)
      if (!parsed.success) continue
      const fileId = paperPhotoFileId(photoRefOf(parsed.data))
      if (fileId) referenced.add(fileId)
    }
    const [profile] = await getDb()
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
    if (profile?.image) referenced.add(profile.image)
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
