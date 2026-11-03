import { parseUserId } from "@workspace/domain"
import { and, eq, inArray, lt } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { files } from "../db/schema.js"
import { referencedPhotoFileIds } from "./photo-references.js"

const UNATTACHED_AVATAR_MAX_AGE_MS = 24 * 60 * 60 * 1000

export async function sweepUnattachedPhotos(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - UNATTACHED_AVATAR_MAX_AGE_MS)
  const stale = await getDb()
    .select({ id: files.id, userId: files.userId })
    .from(files)
    .where(and(eq(files.purpose, "avatar"), lt(files.createdAt, cutoff)))
  const users = new Set(stale.map((row) => row.userId))
  const referenced = new Set<string>()
  for (const userId of users) {
    for (const id of await referencedPhotoFileIds(parseUserId(userId))) {
      referenced.add(id)
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
