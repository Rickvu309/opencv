import {
  DUPLICATE_JOB_MESSAGE,
  ERROR_CODES,
  generateKeyBetween,
  normalizeJobUrl,
  parseJobId,
  parsePaperId,
  type JobId,
  type JobStage,
  type UserId,
} from "@workspace/domain"
import { and, asc, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { jobs } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"

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
    cvDocId: paperIdOrNull(row.cvDocId ?? row.cvPackageId),
    letterDocId: paperIdOrNull(row.letterDocId ?? row.letterPackageId),
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
