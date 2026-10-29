import {
  isCvBlockDocument,
  isCvDocument,
  paperPhotoFileId,
  storedPaperDocumentSchema,
  type PaperView,
  type UserId,
} from "@workspace/domain"
import { and, eq, isNull, sql } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity, paperDocs, user } from "../db/schema.js"

export function photoRefOf(document: PaperView["document"]) {
  if (isCvBlockDocument(document)) return document.header.photo
  if (isCvDocument(document)) return document.photoUrl
  return undefined
}

export async function referencedPhotoFileIds(userId: UserId) {
  const referenced = new Set<string>()
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
  return referenced
}
