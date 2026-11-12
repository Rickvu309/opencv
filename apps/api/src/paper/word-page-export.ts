import { PAPER_CANVAS_PROFILE } from "@workspace/domain"
import { and, eq } from "drizzle-orm"

import { getDb } from "../db/context.js"
import {
  jobs,
  paperPackageHeads,
  paperPackageTrash,
  paperPackageVersions,
} from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import { completeVersion } from "./package-store.js"

export const WORD_PAGE_EXPORT_BYTES = 64 * 1024 * 1024

type ListedPage = {
  docId: string
  incarnation: string
  revision: string
  name: string
  kind: "cv" | "letter"
  canvasProfile: string | null
  createdAt: Date
  updatedAt: Date
  byteSize: number
  deletedAt: Date | null
  trashedJobs: string[]
}

export type ExportedWordPage = {
  id: string
  name: string
  kind: "cv" | "letter"
  imported: boolean
  file: string | null
  byteSize: number
  linkedJobs: { id: string; title: string; company: string }[]
  deleted: boolean
  deletedAt: string | null
  omitted: "over-export-limit" | "unreadable" | null
  createdAt: string
  updatedAt: string
}

export type ExportedWordFile = { path: string; bytes: Buffer }

function versionJoin(
  table: typeof paperPackageHeads | typeof paperPackageTrash
) {
  return and(
    eq(table.docId, paperPackageVersions.docId),
    eq(table.userId, paperPackageVersions.userId),
    eq(table.incarnation, paperPackageVersions.incarnation),
    eq(table.revision, paperPackageVersions.revision)
  )
}

const listedColumns = {
  docId: paperPackageVersions.docId,
  incarnation: paperPackageVersions.incarnation,
  revision: paperPackageVersions.revision,
  name: paperPackageVersions.name,
  kind: paperPackageVersions.kind,
  updatedAt: paperPackageVersions.createdAt,
  byteSize: paperPackageVersions.byteSize,
}

async function listedPages(owner: string): Promise<ListedPage[]> {
  const live = await getDb()
    .select({
      ...listedColumns,
      canvasProfile: paperPackageHeads.canvasProfile,
      createdAt: paperPackageHeads.createdAt,
    })
    .from(paperPackageHeads)
    .innerJoin(paperPackageVersions, versionJoin(paperPackageHeads))
    .where(eq(paperPackageHeads.userId, owner))
  const trashed = await getDb()
    .select({
      ...listedColumns,
      canvasProfile: paperPackageTrash.canvasProfile,
      createdAt: paperPackageTrash.headCreatedAt,
      deletedAt: paperPackageTrash.deletedAt,
      trashedJobs: paperPackageTrash.linkedJobs,
    })
    .from(paperPackageTrash)
    .innerJoin(paperPackageVersions, versionJoin(paperPackageTrash))
    .where(eq(paperPackageTrash.userId, owner))
  const newestFirst = (left: ListedPage, right: ListedPage) =>
    right.updatedAt.getTime() - left.updatedAt.getTime() ||
    left.docId.localeCompare(right.docId)
  const touched = <Page extends ListedPage>(page: Page) => ({
    ...page,
    updatedAt: new Date(
      Math.max(page.updatedAt.getTime(), page.createdAt.getTime())
    ),
  })
  return [
    ...live
      .map((page) => touched({ ...page, deletedAt: null, trashedJobs: [] }))
      .sort(newestFirst),
    ...trashed.map(touched).sort(newestFirst),
  ]
}

async function ownedJobs(owner: string) {
  return getDb()
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      cvPackageId: jobs.cvPackageId,
      letterPackageId: jobs.letterPackageId,
    })
    .from(jobs)
    .where(eq(jobs.userId, owner))
}

async function pageBytes(owner: string, page: ListedPage) {
  const version = (
    await getDb()
      .select()
      .from(paperPackageVersions)
      .where(
        and(
          eq(paperPackageVersions.userId, owner),
          eq(paperPackageVersions.docId, page.docId),
          eq(paperPackageVersions.incarnation, page.incarnation),
          eq(paperPackageVersions.revision, page.revision)
        )
      )
      .limit(1)
  )[0]
  if (!version) return null
  try {
    const { artifact } = await completeVersion(version)
    return Buffer.from(artifact.bytes)
  } catch (error) {
    if (error instanceof CommandError) return null
    throw error
  }
}

const UNSAFE_FILE_CHARACTERS = new Set('/\\:*?"<>|')

function safeCharacter(character: string) {
  const code = character.charCodeAt(0)
  return code < 32 || code === 127 || UNSAFE_FILE_CHARACTERS.has(character)
    ? "-"
    : character
}

function fileStem(name: string) {
  const stem = Array.from(name, safeCharacter)
    .join("")
    .replace(/^[\s.-]+|[\s.]+$/g, "")
    .slice(0, 80)
  return stem || "Untitled"
}

function filePath(page: ListedPage, taken: Set<string>) {
  const folder = page.deletedAt ? "word-pages/deleted" : "word-pages"
  const short = `${folder}/${fileStem(page.name)} (${page.docId.slice(0, 8)}).docx`
  const path = taken.has(short)
    ? `${folder}/${fileStem(page.name)} (${page.docId}).docx`
    : short
  taken.add(path)
  return path
}

export async function collectWordPageExport(
  owner: string,
  budgetBytes = WORD_PAGE_EXPORT_BYTES
) {
  const pages = await listedPages(owner)
  const jobRows = await ownedJobs(owner)
  const files: ExportedWordFile[] = []
  const entries: ExportedWordPage[] = []
  const taken = new Set<string>()
  let spent = 0
  for (const page of pages) {
    const linkedJobs = jobRows
      .filter((job) =>
        page.deletedAt
          ? page.trashedJobs.includes(job.id)
          : job.cvPackageId === page.docId || job.letterPackageId === page.docId
      )
      .map((job) => ({ id: job.id, title: job.title, company: job.company }))
    const fits = spent + page.byteSize <= budgetBytes
    const bytes = fits ? await pageBytes(owner, page) : null
    const path = bytes ? filePath(page, taken) : null
    if (bytes && path) {
      spent += bytes.length
      files.push({ path, bytes })
    }
    entries.push({
      id: page.docId,
      name: page.name,
      kind: page.kind,
      imported: page.canvasProfile !== PAPER_CANVAS_PROFILE,
      file: path,
      byteSize: page.byteSize,
      linkedJobs,
      deleted: page.deletedAt !== null,
      deletedAt: page.deletedAt?.toISOString() ?? null,
      omitted: bytes ? null : fits ? "unreadable" : "over-export-limit",
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    })
  }
  return { pages: entries, files }
}
