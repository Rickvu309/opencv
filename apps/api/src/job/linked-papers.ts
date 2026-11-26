import {
  ERROR_CODES,
  parsePaperId,
  type Actor,
  type JobId,
  type PaperId,
  type UserId,
} from "@workspace/domain/kernel"
import { and, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import {
  paperDocs,
  paperPackageHeads,
  paperPackageVersions,
} from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import { changeJob, ownedJob, toJob, type JobRow } from "./store.js"

type PaperKind = "cv" | "letter"

async function ownedPaper(userId: string, docId: string) {
  const [doc] = await getDb()
    .select({ id: paperDocs.id, name: paperDocs.name, kind: paperDocs.kind })
    .from(paperDocs)
    .where(and(eq(paperDocs.id, docId), eq(paperDocs.userId, userId)))
    .limit(1)
  if (doc) return { ...doc, wordPage: false }
  const [page] = await getDb()
    .select({
      id: paperPackageHeads.docId,
      name: paperPackageVersions.name,
      kind: paperPackageVersions.kind,
    })
    .from(paperPackageHeads)
    .innerJoin(
      paperPackageVersions,
      and(
        eq(paperPackageVersions.docId, paperPackageHeads.docId),
        eq(paperPackageVersions.revision, paperPackageHeads.revision)
      )
    )
    .where(
      and(
        eq(paperPackageHeads.docId, docId),
        eq(paperPackageHeads.userId, userId)
      )
    )
    .limit(1)
  return page ? { ...page, wordPage: true } : null
}

function linkedId(row: JobRow, kind: PaperKind) {
  return kind === "cv"
    ? (row.cvDocId ?? row.cvPackageId)
    : (row.letterDocId ?? row.letterPackageId)
}

function links(kind: PaperKind, doc: string | null, wordPage: string | null) {
  return kind === "cv"
    ? { cvDocId: doc, cvPackageId: wordPage }
    : { letterDocId: doc, letterPackageId: wordPage }
}

async function named(userId: UserId, docId: string | null) {
  const paper = docId ? await ownedPaper(userId, docId) : null
  return paper ? { id: parsePaperId(paper.id), name: paper.name } : null
}

export async function linkedPapers(userId: UserId, row: JobRow) {
  return {
    cv: await named(userId, linkedId(row, "cv")),
    letter: await named(userId, linkedId(row, "letter")),
  }
}

export async function linkPaper(
  actor: Actor,
  jobId: JobId,
  docId: PaperId,
  kind: PaperKind
) {
  const job = await ownedJob(actor.userId, jobId)
  const paper = await ownedPaper(actor.userId, docId)
  if (!paper || paper.kind !== kind)
    throw new CommandError(ERROR_CODES.NOT_FOUND, "Document not found")
  const previous = linkedId(job, kind)
  const changed = await changeJob(
    job,
    links(kind, paper.wordPage ? null : docId, paper.wordPage ? docId : null)
  )
  return {
    ...toJob(changed),
    previousDocId: previous ? parsePaperId(previous) : null,
    docName: paper.name,
  }
}

export async function unlinkPaper(actor: Actor, jobId: JobId, kind: PaperKind) {
  const job = await ownedJob(actor.userId, jobId)
  return toJob(await changeJob(job, links(kind, null, null)))
}
