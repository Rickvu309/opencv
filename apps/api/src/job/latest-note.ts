import type { JobId, UserId } from "@workspace/domain"
import { and, desc, eq, isNull } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity } from "../db/schema.js"

export async function latestNote(userId: UserId, jobId: JobId) {
  const [row] = await getDb()
    .select({ summary: activity.summary })
    .from(activity)
    .where(
      and(
        eq(activity.userId, userId),
        eq(activity.command, "job.addNote"),
        eq(activity.subjectId, jobId),
        isNull(activity.undoneAt)
      )
    )
    .orderBy(desc(activity.createdAt))
    .limit(1)
  return row?.summary ?? ""
}
