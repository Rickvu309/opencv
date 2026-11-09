import { and, eq, exists, isNull, notExists, sql } from "drizzle-orm"

import { getDb } from "../db/context.js"
import {
  activity,
  paperPackageCandidates,
  paperPackageHeads,
  pendingActions,
} from "../db/schema.js"

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
