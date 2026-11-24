import {
  COMPANY_REQUIRED_MESSAGE,
  ERROR_CODES,
  JOB_ACTIVITY_PATCH_KEYS,
  sourceHostFromUrl,
  type Actor,
  type JobCreateInput,
  type JobId,
  type JobPatch,
  type JobStage,
  type UserId,
} from "@workspace/domain"
import { eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { jobs } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError } from "../registry/errors.js"
import { checklistOf } from "./checklist.js"
import {
  changeJob,
  endOfStage,
  jobsOf,
  ownedJob,
  refuseLinkAlreadySaved,
  toJob,
} from "./job-row.js"
import { latestNote } from "./latest-note.js"
import { linkedPapers } from "./linked-papers.js"

const PATCH_KEYS = [
  "title",
  "company",
  "location",
  "priority",
  "interviewAt",
  "deadline",
  "recruiterName",
  "recruiterEmail",
  "description",
  "jobUrl",
  "posting",
] as const satisfies readonly (keyof JobPatch)[]

export async function createJob(actor: Actor, input: JobCreateInput) {
  const company = input.company?.trim() ?? ""
  if (!company)
    throw new CommandError(
      ERROR_CODES.COMPANY_REQUIRED,
      COMPANY_REQUIRED_MESSAGE
    )
  const jobUrl = input.jobUrl?.trim() || null
  if (jobUrl && !input.anyway)
    await refuseLinkAlreadySaved(actor.userId, jobUrl)
  const stage = input.stage ?? "saved"
  const now = new Date()
  const [row] = await getDb()
    .insert(jobs)
    .values({
      id: createId(now.getTime()),
      userId: actor.userId,
      title: input.title.trim(),
      company,
      stage,
      position: await endOfStage(actor.userId, stage),
      location: input.location?.trim() || null,
      jobUrl,
      sourceHost:
        input.sourceHost?.trim() || sourceHostFromUrl(jobUrl ?? undefined),
      description: input.description ?? null,
      deadline: input.deadline ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Job not found")
  const job = toJob(row)
  return { ...job, sourceLabel: job.sourceHost ?? "the board" }
}

export async function updateJob(actor: Actor, jobId: JobId, patch: JobPatch) {
  const current = await ownedJob(actor.userId, jobId)
  if (patch.jobUrl)
    await refuseLinkAlreadySaved(actor.userId, patch.jobUrl, current.id)
  const before = toJob(current)
  const previousPatch = Object.fromEntries(
    PATCH_KEYS.filter((key) => patch[key] !== undefined).map((key) => [
      key,
      before[key],
    ])
  ) as JobPatch
  const { priority, interviewAt, ...facts } = patch
  void priority
  const changed = await changeJob(current, {
    ...facts,
    ...(interviewAt === undefined
      ? {}
      : { interviewAt: interviewAt ? new Date(interviewAt) : null }),
  })
  return {
    ...toJob(changed),
    previousPatch,
    watched: JOB_ACTIVITY_PATCH_KEYS.some((key) => patch[key] !== undefined),
  }
}

export async function moveJob(
  actor: Actor,
  jobId: JobId,
  stage: JobStage,
  position?: string
) {
  const current = await ownedJob(actor.userId, jobId)
  const changed = await changeJob(current, {
    stage,
    position: position ?? (await endOfStage(actor.userId, stage)),
  })
  return {
    ...toJob(changed),
    fromStage: current.stage,
    fromPosition: current.position,
  }
}

export async function starJob(actor: Actor, jobId: JobId, starred: boolean) {
  const current = await ownedJob(actor.userId, jobId)
  const changed = await changeJob(current, { starred })
  return { ...toJob(changed), previousStarred: current.starred }
}

export async function deleteJob(actor: Actor, jobId: JobId) {
  await ownedJob(actor.userId, jobId)
  await getDb().delete(jobs).where(eq(jobs.id, jobId))
  return { id: jobId }
}

export async function getJob(userId: UserId, jobId: JobId) {
  const row = await ownedJob(userId, jobId)
  return {
    ...toJob(row),
    note: await latestNote(userId, jobId),
    checklist: await checklistOf(jobId),
    linked: await linkedPapers(userId, row),
  }
}

function has(part: string | undefined, whole: string | null) {
  return part ? (whole ?? "").toLowerCase().includes(part.toLowerCase()) : true
}

export async function listJobs(
  userId: UserId,
  filter: { stage?: JobStage; company?: string; location?: string } = {}
) {
  const rows = await jobsOf(userId)
  return rows
    .filter((row) => !filter.stage || row.stage === filter.stage)
    .filter((row) => has(filter.company, row.company))
    .filter((row) => has(filter.location, row.location))
    .map(toJob)
}

export async function calendarJobs(userId: UserId, from: string, to: string) {
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Use a from and to date."
    )
  const within = (date: Date | null) =>
    date !== null && date >= start && date <= end
  const rows = await getDb().select().from(jobs).where(eq(jobs.userId, userId))
  return rows
    .filter(
      (row) =>
        within(row.interviewAt) ||
        within(row.deadline ? new Date(`${row.deadline}T00:00:00.000Z`) : null)
    )
    .map(toJob)
}
