import { randomUUID } from "node:crypto"

import type { PaperView } from "@workspace/domain"
import { and, eq, or } from "drizzle-orm"
import { z } from "zod"

import { getDb } from "../db/context.js"
import {
  jobs,
  paperPackageHeads,
  paperPackageTrash,
  paperPackageVersions,
} from "../db/schema.js"
import { ownedPackagePaper } from "./package-list.js"
import {
  exportWordPackage,
  publishWordPackage,
  restoreWordHead,
  stageWordPackage,
} from "./package-store.js"

const docIdSchema = z.string().uuid()
const NAME_MAX = 200

export type WordPageCopy = { stageId: string; canvasProfile: string | null }

export function wordPageName(name: string) {
  if (/\.docx$/i.test(name)) return name
  return `${name.slice(0, NAME_MAX - 5)}.docx`
}

function headQuery(owner: string, docId: string) {
  return getDb()
    .select()
    .from(paperPackageHeads)
    .where(
      and(
        eq(paperPackageHeads.userId, owner),
        eq(paperPackageHeads.docId, docId)
      )
    )
    .limit(1)
}

async function ownedWordHead(owner: string, docId: string) {
  if (!docIdSchema.safeParse(docId).success) return null
  const [head] = await headQuery(owner, docId)
  return head ?? null
}

async function lockedWordHead(owner: string, docId: string) {
  if (!docIdSchema.safeParse(docId).success) return null
  const [head] = await headQuery(owner, docId).for("update")
  return head ?? null
}

export async function renameWordPage(
  owner: string,
  docId: string,
  name: string
): Promise<(PaperView & { previousName: string }) | null> {
  const current = await ownedPackagePaper(owner, docId)
  if (!current) return null
  await getDb()
    .update(paperPackageVersions)
    .set({ name: wordPageName(name) })
    .where(
      and(
        eq(paperPackageVersions.userId, owner),
        eq(paperPackageVersions.docId, docId)
      )
    )
  const renamed = await ownedPackagePaper(owner, docId)
  if (!renamed) return null
  return { ...renamed, previousName: current.name }
}

export async function stageWordPageCopy(
  owner: string,
  docId: string
): Promise<WordPageCopy | null> {
  const head = await ownedWordHead(owner, docId)
  const page = await ownedPackagePaper(owner, docId)
  if (!head || !page) return null
  const exported = await exportWordPackage(owner, docId, head.revision)
  const staged = await stageWordPackage(
    owner,
    {
      requestId: randomUUID(),
      name: `Copy of ${page.name}`.slice(0, NAME_MAX),
      kind: page.kind,
    },
    exported.bytes
  )
  return { stageId: staged.stageId, canvasProfile: head.canvasProfile }
}

export async function publishWordPageCopy(owner: string, copy: WordPageCopy) {
  const published = await publishWordPackage(
    owner,
    copy.stageId,
    copy.canvasProfile
  )
  return ownedPackagePaper(owner, published.docId)
}

export async function deleteWordPage(owner: string, docId: string) {
  const head = await lockedWordHead(owner, docId)
  const page = await ownedPackagePaper(owner, docId)
  if (!head || !page) return null
  const linked = await getDb()
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, owner),
        or(eq(jobs.cvPackageId, docId), eq(jobs.letterPackageId, docId))
      )
    )
  await getDb()
    .insert(paperPackageTrash)
    .values({
      docId,
      userId: owner,
      incarnation: head.incarnation,
      revision: head.revision,
      canvasProfile: head.canvasProfile,
      headCreatedAt: head.createdAt,
      linkedJobs: linked.map((job) => job.id),
    })
  await getDb()
    .delete(paperPackageHeads)
    .where(
      and(
        eq(paperPackageHeads.userId, owner),
        eq(paperPackageHeads.docId, docId)
      )
    )
  return { id: page.id, format: "word" as const, name: page.name }
}

export async function restoreWordPage(owner: string, docId: string) {
  if (!docIdSchema.safeParse(docId).success) return null
  const [trashed] = await getDb()
    .select()
    .from(paperPackageTrash)
    .where(
      and(
        eq(paperPackageTrash.userId, owner),
        eq(paperPackageTrash.docId, docId)
      )
    )
    .limit(1)
    .for("update")
  if (!trashed) {
    const page = await ownedPackagePaper(owner, docId)
    return page ? { page, linkedJobs: [] as string[] } : null
  }
  await restoreWordHead(owner, trashed)
  await getDb()
    .delete(paperPackageTrash)
    .where(
      and(
        eq(paperPackageTrash.userId, owner),
        eq(paperPackageTrash.docId, docId)
      )
    )
  const page = await ownedPackagePaper(owner, docId)
  return page ? { page, linkedJobs: trashed.linkedJobs } : null
}

export async function isWordPageDeleted(owner: string, docId: string) {
  if (!docIdSchema.safeParse(docId).success) return false
  const [trashed] = await getDb()
    .select({ docId: paperPackageTrash.docId })
    .from(paperPackageTrash)
    .where(
      and(
        eq(paperPackageTrash.userId, owner),
        eq(paperPackageTrash.docId, docId)
      )
    )
    .limit(1)
  return trashed !== undefined
}
