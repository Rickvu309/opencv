import {
  ERROR_CODES,
  generateKeyBetween,
  type Actor,
  type JobId,
} from "@workspace/domain"
import { and, asc, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { jobChecklist } from "../db/schema.js"
import { createId } from "../platform/id.js"
import { CommandError } from "../registry/errors.js"
import { ownedJob } from "./store.js"

export async function checklistOf(jobId: JobId) {
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

function onJob(jobId: JobId, itemId: string) {
  return and(eq(jobChecklist.id, itemId), eq(jobChecklist.jobId, jobId))
}

export async function addChecklistItem(
  actor: Actor,
  jobId: JobId,
  label: string
) {
  await ownedJob(actor.userId, jobId)
  const last = (await checklistOf(jobId)).at(-1)?.position ?? null
  const id = createId()
  await getDb()
    .insert(jobChecklist)
    .values({ id, jobId, label, position: generateKeyBetween(last, null) })
  return { id, jobId, label, done: false }
}

export async function setChecklistItem(
  actor: Actor,
  jobId: JobId,
  itemId: string,
  done: boolean
) {
  await ownedJob(actor.userId, jobId)
  const [item] = await getDb()
    .select()
    .from(jobChecklist)
    .where(onJob(jobId, itemId))
    .limit(1)
  if (!item)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Checklist item not found")
  await getDb().update(jobChecklist).set({ done }).where(onJob(jobId, itemId))
  return { id: itemId, jobId, done, previousDone: item.done }
}

export async function removeChecklistItem(
  actor: Actor,
  jobId: JobId,
  itemId: string
) {
  await ownedJob(actor.userId, jobId)
  await getDb().delete(jobChecklist).where(onJob(jobId, itemId))
  return { id: itemId, jobId }
}
