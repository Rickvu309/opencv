import {
  ERROR_CODES,
  blankPaper,
  paperViewSchema,
  parsePaperId,
  type PaperView,
} from "@workspace/domain"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { getDb } from "../db/context.js"
import { paperPackageHeads, paperPackageVersions } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import { readWordOutline } from "./word-reading.js"

const docIdSchema = z.string().uuid()

function packagePaper(row: {
  docId: string
  name: string
  kind: "cv" | "letter"
  createdAt: Date
}): PaperView {
  const when = row.createdAt.toISOString()
  return paperViewSchema.parse({
    id: parsePaperId(row.docId),
    name: row.name,
    kind: row.kind,
    templateId: "simple",
    status: "draft",
    paper: blankPaper(row.kind),
    contentVersion: 1,
    checks: [],
    pageChoice: "unset",
    isFavorite: false,
    sourceFileId: null,
    format: "word",
    createdAt: when,
    updatedAt: when,
  })
}

function packageRows(owner: string, docId: string | undefined) {
  return getDb()
    .select({
      docId: paperPackageVersions.docId,
      name: paperPackageVersions.name,
      kind: paperPackageVersions.kind,
      createdAt: paperPackageVersions.createdAt,
    })
    .from(paperPackageHeads)
    .innerJoin(
      paperPackageVersions,
      and(
        eq(paperPackageHeads.docId, paperPackageVersions.docId),
        eq(paperPackageHeads.userId, paperPackageVersions.userId),
        eq(paperPackageHeads.incarnation, paperPackageVersions.incarnation),
        eq(paperPackageHeads.revision, paperPackageVersions.revision)
      )
    )
    .where(
      and(
        eq(paperPackageHeads.userId, owner),
        docId ? eq(paperPackageHeads.docId, docId) : undefined
      )
    )
}

export async function listPackagePapers(owner: string) {
  return (await packageRows(owner, undefined)).map(packagePaper)
}

export async function ownedPackagePaper(owner: string, docId: string) {
  if (!docIdSchema.safeParse(docId).success) return null
  const row = (await packageRows(owner, docId).limit(1))[0]
  return row ? packagePaper(row) : null
}

export async function ownedPackageOutline(
  owner: string,
  docId: string,
  blockIds: readonly string[] | undefined,
  maxChars: number,
  cursor?: string
) {
  if (!(await ownedPackagePaper(owner, docId))) return null
  return readWordOutline(owner, { docId, cursor }, blockIds, maxChars)
}

export function missingDocument(error: unknown) {
  return error instanceof CommandError && error.code === ERROR_CODES.NOT_FOUND
}
