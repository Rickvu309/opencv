import { and, eq, or } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { jobs, paperPackageHeads, paperPackageTrash } from "../db/schema.js"

export async function trashStoredWordPage(userId: string, docId: string) {
  const linked = await getDb()
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        or(
          eq(jobs.cvDocId, docId),
          eq(jobs.letterDocId, docId),
          eq(jobs.cvPackageId, docId),
          eq(jobs.letterPackageId, docId)
        )
      )
    )
  const [head] = await getDb()
    .delete(paperPackageHeads)
    .where(
      and(
        eq(paperPackageHeads.docId, docId),
        eq(paperPackageHeads.userId, userId)
      )
    )
    .returning()
  if (!head) return
  await getDb()
    .insert(paperPackageTrash)
    .values({
      docId: head.docId,
      userId: head.userId,
      incarnation: head.incarnation,
      revision: head.revision,
      canvasProfile: head.canvasProfile,
      headCreatedAt: head.createdAt,
      linkedJobs: linked.map((job) => job.id),
    })
    .onConflictDoNothing()
}
