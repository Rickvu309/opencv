import {
  ERROR_CODES,
  parseUserId,
  type JobId,
  type JobPriority,
  type QueryOutput,
  type UserId,
} from "@workspace/domain"
import { and, count, eq, sql } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { jobs } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import {
  assertPriorityGrant,
  priorityBasisOk,
  type WriteGrant,
} from "../registry/write-grant.js"
import { ownedJob, toJob } from "./job-row.js"

const PRIORITIES = ["low", "normal", "high"] as const

function alreadyChanged() {
  return new CommandError(
    ERROR_CODES.CONFLICT,
    "This job's priority was already changed, so your change was not saved"
  )
}

export async function priorityCounts(
  userId: UserId
): Promise<QueryOutput<"job.priorityCounts">> {
  const rows = await getDb()
    .select({ priority: jobs.priority, count: count() })
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .groupBy(jobs.priority)
  return PRIORITIES.map((priority) => ({
    priority,
    count: rows.find((row) => row.priority === priority)?.count ?? 0,
  }))
}

export async function writePriority(
  grant: WriteGrant,
  jobId: JobId,
  priority: JobPriority,
  actorId: string = grant.ownerId
) {
  const authority = assertPriorityGrant(grant, actorId, jobId)
  const ownerId = parseUserId(authority.ownerId)
  const current = await ownedJob(ownerId, jobId)
  const expected = authority.expectedRevision
  if (expected !== null && !priorityBasisOk(expected, current.priorityRevision))
    throw alreadyChanged()
  authority.assertOpen()
  const mine = and(eq(jobs.id, current.id), eq(jobs.userId, current.userId))
  const [changed] = await getDb()
    .update(jobs)
    .set({
      priority,
      priorityRevision: sql`case when ${jobs.priority} is distinct from ${priority} then ${jobs.priorityRevision} + 1 else ${jobs.priorityRevision} end`,
      updatedAt: new Date(),
    })
    .where(
      expected === null ? mine : and(mine, eq(jobs.priorityRevision, expected))
    )
    .returning()
  if (!changed) throw alreadyChanged()
  return { ...toJob(changed), previousPriority: current.priority }
}

export async function priorityRevisionFor(
  ownerId: string,
  writes: readonly { name: string; entityId?: string }[]
) {
  const jobId = writes.find(
    (write) => write.name === "job.priority" && write.entityId
  )?.entityId
  if (!jobId) return null
  const [row] = await getDb()
    .select({ priorityRevision: jobs.priorityRevision })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, ownerId)))
    .limit(1)
  return row?.priorityRevision ?? null
}
