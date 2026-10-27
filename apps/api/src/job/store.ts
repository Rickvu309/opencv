import {
  COMPANY_REQUIRED_MESSAGE,
  DUPLICATE_JOB_MESSAGE,
  ERROR_CODES,
  JOB_ACTIVITY_PATCH_KEYS,
  generateKeyBetween,
  normalizeJobUrl,
  sourceHostFromUrl,
  parseJobId,
  parsePaperId,
  type Actor,
  type JobCreateInput,
  type JobId,
  type JobPreview,
  type JobPatch,
  type JobStage,
  type PaperId,
  type UserId,
} from "@workspace/domain"
import { and, asc, desc, eq, gte, isNull, lte, or } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity, jobChecklist, jobs, paperDocs, user } from "../db/schema.js"
import { createId } from "../id.js"
import { CommandError } from "../registry/errors.js"

function iso(value: Date | null) {
  return value ? value.toISOString() : null
}

function paperIdOrNull(value: string | null) {
  return value ? parsePaperId(value) : null
}

export function toJob(row: typeof jobs.$inferSelect) {
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
    interviewAt: iso(row.interviewAt),
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
  const rows = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new CommandError(ERROR_CODES.NOT_FOUND, "Job not found")
  return row
}

async function nextPosition(userId: UserId, stage: JobStage) {
  const rows = await getDb()
    .select({ position: jobs.position })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.stage, stage)))
    .orderBy(asc(jobs.position))
  const last = rows.at(-1)?.position ?? null
  return generateKeyBetween(last, null)
}

async function findDuplicate(userId: UserId, jobUrl: string) {
  const key = normalizeJobUrl(jobUrl)
  if (!key) return null
  const rows = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.jobUrl, jobUrl)))
  const normalized = rows.find(
    (row) => row.jobUrl && normalizeJobUrl(row.jobUrl) === key
  )
  if (normalized) return normalized
  const all = await getDb().select().from(jobs).where(eq(jobs.userId, userId))
  return (
    all.find((row) => row.jobUrl && normalizeJobUrl(row.jobUrl) === key) ?? null
  )
}

export async function latestJobNote(userId: UserId, jobId: JobId) {
  const rows = await getDb()
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
  return rows[0]?.summary ?? ""
}

export async function checklistFor(jobId: JobId) {
  const rows = await getDb()
    .select()
    .from(jobChecklist)
    .where(eq(jobChecklist.jobId, jobId))
    .orderBy(asc(jobChecklist.position))
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    done: row.done,
    position: row.position,
  }))
}

async function linkedDoc(userId: UserId, docId: string | null) {
  if (!docId) return null
  const rows = await getDb()
    .select({ id: paperDocs.id, name: paperDocs.name })
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .limit(1)
  const doc = rows[0]
  return doc ? { id: parsePaperId(doc.id), name: doc.name } : null
}

export async function getJob(userId: UserId, jobId: JobId) {
  const row = await ownedJob(userId, jobId)
  return {
    ...toJob(row),
    note: await latestJobNote(userId, jobId),
    checklist: await checklistFor(jobId),
    linked: {
      cv: await linkedDoc(userId, row.cvDocId),
      letter: await linkedDoc(userId, row.letterDocId),
    },
  }
}

export async function listJobs(
  userId: UserId,
  filter?: { stage?: JobStage; company?: string; location?: string }
) {
  const rows = await getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .orderBy(asc(jobs.position))
  return rows
    .filter((row) => (filter?.stage ? row.stage === filter.stage : true))
    .filter((row) =>
      filter?.company
        ? row.company.toLowerCase().includes(filter.company.toLowerCase())
        : true
    )
    .filter((row) =>
      filter?.location
        ? (row.location ?? "")
            .toLowerCase()
            .includes(filter.location.toLowerCase())
        : true
    )
    .map(toJob)
}

export async function createJob(actor: Actor, input: JobCreateInput) {
  const company = input.company?.trim() ?? ""
  if (!company) {
    throw new CommandError(
      ERROR_CODES.COMPANY_REQUIRED,
      COMPANY_REQUIRED_MESSAGE
    )
  }
  const jobUrl = input.jobUrl?.trim() || null
  if (jobUrl && !input.anyway) {
    const existing = await findDuplicate(actor.userId, jobUrl)
    if (existing) {
      throw new CommandError(ERROR_CODES.DUPLICATE_JOB, DUPLICATE_JOB_MESSAGE, {
        jobId: existing.id,
        stage: existing.stage,
      })
    }
  }
  const stage = input.stage ?? "saved"
  const now = new Date()
  const id = createId(now.getTime())
  await getDb()
    .insert(jobs)
    .values({
      id,
      userId: actor.userId,
      title: input.title.trim(),
      company,
      stage,
      position: await nextPosition(actor.userId, stage),
      location: input.location?.trim() || null,
      jobUrl,
      sourceHost:
        input.sourceHost?.trim() || sourceHostFromUrl(jobUrl ?? undefined),
      description: input.description ?? null,
      deadline: input.deadline ?? null,
      createdAt: now,
      updatedAt: now,
    })
  const job = toJob(await ownedJob(actor.userId, parseJobId(id)))
  return {
    ...job,
    sourceLabel: job.sourceHost ?? "the board",
  }
}

export async function updateJob(actor: Actor, jobId: JobId, patch: JobPatch) {
  const current = await ownedJob(actor.userId, jobId)
  const previousPatch: JobPatch = {}
  if (patch.title !== undefined) previousPatch.title = current.title
  if (patch.company !== undefined) previousPatch.company = current.company
  if (patch.location !== undefined) previousPatch.location = current.location
  if (patch.priority !== undefined) previousPatch.priority = current.priority
  if (patch.interviewAt !== undefined)
    previousPatch.interviewAt = iso(current.interviewAt)
  if (patch.deadline !== undefined) previousPatch.deadline = current.deadline
  if (patch.recruiterName !== undefined)
    previousPatch.recruiterName = current.recruiterName
  if (patch.recruiterEmail !== undefined) {
    previousPatch.recruiterEmail = current.recruiterEmail
  }
  if (patch.description !== undefined)
    previousPatch.description = current.description
  if (patch.jobUrl !== undefined) previousPatch.jobUrl = current.jobUrl
  if (patch.posting !== undefined)
    previousPatch.posting = current.posting ?? undefined
  if (patch.jobUrl) {
    const existing = await findDuplicate(actor.userId, patch.jobUrl)
    if (existing && existing.id !== current.id) {
      throw new CommandError(ERROR_CODES.DUPLICATE_JOB, DUPLICATE_JOB_MESSAGE, {
        jobId: existing.id,
        stage: existing.stage,
      })
    }
  }
  const watched = JOB_ACTIVITY_PATCH_KEYS.some(
    (key) => patch[key] !== undefined
  )
  await getDb()
    .update(jobs)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.company !== undefined ? { company: patch.company } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.interviewAt !== undefined
        ? {
            interviewAt: patch.interviewAt ? new Date(patch.interviewAt) : null,
          }
        : {}),
      ...(patch.deadline !== undefined ? { deadline: patch.deadline } : {}),
      ...(patch.recruiterName !== undefined
        ? { recruiterName: patch.recruiterName }
        : {}),
      ...(patch.recruiterEmail !== undefined
        ? { recruiterEmail: patch.recruiterEmail }
        : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.jobUrl !== undefined ? { jobUrl: patch.jobUrl } : {}),
      ...(patch.posting !== undefined ? { posting: patch.posting } : {}),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, current.id))
  return {
    ...toJob(await ownedJob(actor.userId, jobId)),
    previousPatch,
    watched,
  }
}

export async function moveJob(
  actor: Actor,
  jobId: JobId,
  stage: JobStage,
  position?: string
) {
  const current = await ownedJob(actor.userId, jobId)
  const next = position ?? (await nextPosition(actor.userId, stage))
  await getDb()
    .update(jobs)
    .set({ stage, position: next, updatedAt: new Date() })
    .where(eq(jobs.id, current.id))
  return {
    ...toJob(await ownedJob(actor.userId, jobId)),
    fromStage: current.stage,
    fromPosition: current.position,
  }
}

export async function starJob(actor: Actor, jobId: JobId, starred: boolean) {
  const current = await ownedJob(actor.userId, jobId)
  await getDb()
    .update(jobs)
    .set({ starred, updatedAt: new Date() })
    .where(eq(jobs.id, current.id))
  return {
    ...toJob(await ownedJob(actor.userId, jobId)),
    previousStarred: current.starred,
  }
}

export async function deleteJob(actor: Actor, jobId: JobId) {
  await ownedJob(actor.userId, jobId)
  await getDb().delete(jobs).where(eq(jobs.id, jobId))
  return { id: jobId }
}

export async function addChecklistItem(
  actor: Actor,
  jobId: JobId,
  label: string
) {
  await ownedJob(actor.userId, jobId)
  const rows = await getDb()
    .select({ position: jobChecklist.position })
    .from(jobChecklist)
    .where(eq(jobChecklist.jobId, jobId))
    .orderBy(asc(jobChecklist.position))
  const id = createId()
  await getDb()
    .insert(jobChecklist)
    .values({
      id,
      jobId,
      label,
      position: generateKeyBetween(rows.at(-1)?.position ?? null, null),
    })
  return { id, jobId, label, done: false }
}

export async function setChecklistItem(
  actor: Actor,
  jobId: JobId,
  itemId: string,
  done: boolean
) {
  await ownedJob(actor.userId, jobId)
  const rows = await getDb()
    .select()
    .from(jobChecklist)
    .where(and(eq(jobChecklist.id, itemId), eq(jobChecklist.jobId, jobId)))
    .limit(1)
  const item = rows[0]
  if (!item)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Checklist item not found")
  await getDb()
    .update(jobChecklist)
    .set({ done })
    .where(eq(jobChecklist.id, itemId))
  return { id: itemId, jobId, done, previousDone: item.done }
}

export async function removeChecklistItem(
  actor: Actor,
  jobId: JobId,
  itemId: string
) {
  await ownedJob(actor.userId, jobId)
  await getDb()
    .delete(jobChecklist)
    .where(and(eq(jobChecklist.id, itemId), eq(jobChecklist.jobId, jobId)))
  return { id: itemId, jobId }
}

export async function linkPaper(
  actor: Actor,
  jobId: JobId,
  docId: PaperId,
  kind: "cv" | "letter"
) {
  const job = await ownedJob(actor.userId, jobId)
  const docs = await getDb()
    .select()
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, actor.userId)))
    .limit(1)
  const doc = docs[0]
  if (!doc || doc.kind !== kind) {
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  }
  const previousDocId = paperIdOrNull(
    kind === "cv" ? job.cvDocId : job.letterDocId
  )
  await getDb()
    .update(jobs)
    .set(
      kind === "cv"
        ? { cvDocId: docId, updatedAt: new Date() }
        : { letterDocId: docId, updatedAt: new Date() }
    )
    .where(eq(jobs.id, jobId))
  return {
    ...toJob(await ownedJob(actor.userId, jobId)),
    previousDocId,
    docName: doc.name,
  }
}

export async function unlinkPaper(
  actor: Actor,
  jobId: JobId,
  kind: "cv" | "letter"
) {
  await ownedJob(actor.userId, jobId)
  await getDb()
    .update(jobs)
    .set(
      kind === "cv"
        ? { cvDocId: null, updatedAt: new Date() }
        : { letterDocId: null, updatedAt: new Date() }
    )
    .where(eq(jobs.id, jobId))
  return toJob(await ownedJob(actor.userId, jobId))
}

export async function calendarJobs(userId: UserId, from: string, to: string) {
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new CommandError(
      ERROR_CODES.VALIDATION_ERROR,
      "Use a from and to date."
    )
  }
  const rows = await getDb().select().from(jobs).where(eq(jobs.userId, userId))
  return rows
    .filter((row) => {
      const interview = row.interviewAt
      const deadline = row.deadline
        ? new Date(`${row.deadline}T00:00:00.000Z`)
        : null
      const inInterview = interview
        ? interview >= start && interview <= end
        : false
      const inDeadline = deadline ? deadline >= start && deadline <= end : false
      return inInterview || inDeadline
    })
    .map(toJob)
}

export function parsePostingText(text: string) {
  const match = text.match(/^(.+?) is hiring an (.+?) in ([^.]+)\./)
  if (!match) return null
  return {
    company: match[1]?.trim() ?? "",
    title: match[2]?.trim() ?? "",
    location: match[3]?.trim() ?? "",
  }
}

export async function previewJob(
  actor: Actor,
  input: { url?: string; text?: string },
  fetchPosting: (
    url: string
  ) => Promise<{ ok: true; text: string } | { ok: false; message: string }>,
  interpret?: (
    text: string
  ) => Promise<{ title: string; company: string; location: string } | null>
): Promise<JobPreview> {
  let text = input.text?.trim() ?? ""
  if (!text && input.url) {
    const fetched = await fetchPosting(input.url)
    if (!fetched.ok) {
      return {
        status: "unreadable" as const,
        fields: {},
        message: fetched.message,
      }
    }
    text = fetched.text
  }
  if (!text) {
    return {
      status: "unreadable" as const,
      fields: {},
      message: "Add a link or some text.",
    }
  }
  const parsed = parsePostingText(text)
  let company = parsed?.company ?? ""
  let title = parsed?.title ?? ""
  let location = parsed?.location ?? ""
  if (interpret) {
    try {
      const modelFields = await interpret(text)
      if (modelFields) {
        company = modelFields.company || company
        title = modelFields.title || title
        location = modelFields.location || location
      }
    } catch {
      // A missing key keeps the deterministic parse. This read does not open a usage row.
    }
  }
  if (input.url) {
    const duplicate = await findDuplicate(actor.userId, input.url)
    if (duplicate) {
      return {
        status: "duplicate" as const,
        jobId: parseJobId(duplicate.id),
        stage: duplicate.stage,
        fields: {
          title: title || duplicate.title,
          company: company || duplicate.company,
          location,
        },
      }
    }
  }
  if (!company) {
    return {
      status: "company-missing" as const,
      fields: { title, company, location },
    }
  }
  return {
    status: "filled" as const,
    fields: { title, company, location, description: text },
  }
}

export async function jobsBetween(userId: UserId, from: Date, to: Date) {
  const rows = await getDb()
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        or(
          and(gte(jobs.interviewAt, from), lte(jobs.interviewAt, to)),
          and(
            gte(jobs.deadline, from.toISOString().slice(0, 10)),
            lte(jobs.deadline, to.toISOString().slice(0, 10))
          )
        )
      )
    )
  return rows
}
