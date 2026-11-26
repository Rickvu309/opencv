import { and, eq, exists, isNull, notExists, or, sql } from "drizzle-orm"

import { getDb } from "../../db/context.js"
import {
  activity,
  paperPackageCandidates,
  paperPackageHeads,
  paperPackageTrash,
  pendingActions,
} from "../../db/schema.js"

export function candidatePageInTrash() {
  return exists(
    getDb()
      .select({ docId: paperPackageTrash.docId })
      .from(paperPackageTrash)
      .where(
        and(
          eq(paperPackageTrash.userId, paperPackageCandidates.userId),
          eq(paperPackageTrash.docId, paperPackageCandidates.docId)
        )
      )
  )
}

export async function pruneUnreachableCandidates(owner: string) {
  const candidate = paperPackageCandidates
  await getDb()
    .select({ id: candidate.id })
    .from(candidate)
    .where(eq(candidate.userId, owner))
    .for("update")
  const namedByPendingReview = notExists(
    getDb()
      .select({ id: pendingActions.id })
      .from(pendingActions)
      .where(
        and(
          eq(pendingActions.userId, candidate.userId),
          eq(pendingActions.status, "pending"),
          sql`${pendingActions.frozenReview} #>> '{candidate,id}' = ${candidate.id}::text`
        )
      )
  )
  const namedByLiveUndo = notExists(
    getDb()
      .select({ id: activity.id })
      .from(activity)
      .where(
        and(
          eq(activity.userId, candidate.userId),
          isNull(activity.undoneAt),
          sql`(
            ${activity.reversalInput} #>> '{candidate,id}' = ${candidate.id}::text
            or ${activity.result} #>> '{restore,id}' = ${candidate.id}::text
          )`,
          or(
            exists(
              getDb()
                .select({ revision: paperPackageHeads.revision })
                .from(paperPackageHeads)
                .where(
                  and(
                    eq(paperPackageHeads.userId, candidate.userId),
                    eq(paperPackageHeads.docId, candidate.docId),
                    eq(paperPackageHeads.incarnation, candidate.incarnation),
                    eq(paperPackageHeads.revision, candidate.forwardRevision)
                  )
                )
            ),
            exists(
              getDb()
                .select({ revision: paperPackageTrash.revision })
                .from(paperPackageTrash)
                .where(
                  and(
                    eq(paperPackageTrash.userId, candidate.userId),
                    eq(paperPackageTrash.docId, candidate.docId),
                    eq(paperPackageTrash.incarnation, candidate.incarnation),
                    eq(paperPackageTrash.revision, candidate.forwardRevision)
                  )
                )
            )
          )
        )
      )
  )
  const oldEnough = sql`${candidate.createdAt} < now() - interval '15 minutes'`
  await getDb()
    .delete(candidate)
    .where(
      and(
        eq(candidate.userId, owner),
        namedByPendingReview,
        namedByLiveUndo,
        oldEnough
      )
    )
}
