import {
  DUPLICATE_JOB_MESSAGE,
  generateKeyBetween,
  normalizeJobUrl,
  type JobPriority,
  type JobStage,
} from "@workspace/domain/apply"
import {
  ERROR_CODES,
  parseJobId,
  parsePaperId,
  jobPriorityResource,
  parseUserId,
  type JobId,
  type QueryOutput,
  type UserId,
} from "@workspace/domain/kernel"
import { and, asc, count, eq, sql } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { jobs } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import {
  assertWriteGrant,
  basisRevisionOk,
  type WriteGrant,
} from "../registry/write-grant.js"

export type JobRow = typeof jobs.$inferSelect

function paperIdOrNull(value: string | null) {
  return value ? parsePaperId(value) : null
}

export function toJob(row: JobRow) {
  return {
    id: parseJobId(row.id),
    title: row.title,
    company: row.company,
    stage: row.stage,
    position: row.position,
    location: row.location,
    priority: row.priority,
    jobUrl: row.jobUrl,
    sourceHost: row.sourceHost,
    description: row.description,
    posting: row.posting,
    interviewAt: row.interviewAt ? row.interviewAt.toISOString() : null,
    deadline: row.deadline,
    recruiterName: row.recruiterName,
    recruiterEmail: row.recruiterEmail,
    cvDocId: paperIdOrNull(row.cvDocId),
    letterDocId: paperIdOrNull(row.letterDocId),
    starred: row.starred,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function ownedJob(userId: UserId, jobId: JobId) {
  const [row] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1)
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Job not found")
  return row
}

export function jobsOf(userId: UserId) {
  return getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .orderBy(asc(jobs.position))
}

export async function changeJob(
  row: JobRow,
  change: Partial<typeof jobs.$inferInsert>
) {
  const [changed] = await getDb()
    .update(jobs)
    .set({ ...change, updatedAt: new Date() })
    .where(eq(jobs.id, row.id))
    .returning()
  if (!changed) throw new CommandError(ERROR_CODES.NOT_FOUND, "Job not found")
  return changed
}

export async function endOfStage(userId: UserId, stage: JobStage) {
  const inStage = (await jobsOf(userId)).filter((row) => row.stage === stage)
  return generateKeyBetween(inStage.at(-1)?.position ?? null, null)
}

export async function jobWithLink(userId: UserId, jobUrl: string) {
  const key = normalizeJobUrl(jobUrl)
  if (!key) return null
  const rows = await jobsOf(userId)
  return (
    rows.find((row) => row.jobUrl && normalizeJobUrl(row.jobUrl) === key) ??
    null
  )
}

export async function refuseLinkAlreadySaved(
  userId: UserId,
  jobUrl: string,
  exceptJobId?: string
) {
  const existing = await jobWithLink(userId, jobUrl)
  if (!existing || existing.id === exceptJobId) return
  throw new CommandError(ERROR_CODES.DUPLICATE_JOB, DUPLICATE_JOB_MESSAGE, {
    jobId: existing.id,
    stage: existing.stage,
  })
}

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
  const authority = assertWriteGrant(grant, jobPriorityResource, actorId, jobId)
  const ownerId = parseUserId(authority.ownerId)
  const current = await ownedJob(ownerId, jobId)
  const expected = authority.expectedRevision
  if (expected !== null && !basisRevisionOk(expected, current.priorityRevision))
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

export async function priorityRevision(ownerId: string, jobId: string) {
  const [row] = await getDb()
    .select({ priorityRevision: jobs.priorityRevision })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, ownerId)))
    .limit(1)
  return row?.priorityRevision ?? null
}
