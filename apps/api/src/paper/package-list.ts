import {
  ERROR_CODES,
  PAPER_CANVAS_PROFILE,
  blankCv,
  blankLetter,
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
    paper: row.kind === "cv" ? blankCv() : blankLetter(),
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

function packageRows(
  owner: string,
  docId: string | undefined,
  mintedOnly: boolean
) {
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
        mintedOnly
          ? eq(paperPackageHeads.canvasProfile, PAPER_CANVAS_PROFILE)
          : undefined,
        docId ? eq(paperPackageHeads.docId, docId) : undefined
      )
    )
}

export async function listMintedPackagePapers(owner: string) {
  return (await packageRows(owner, undefined, true)).map(packagePaper)
}

export async function ownedPackagePaper(owner: string, docId: string) {
  if (!docIdSchema.safeParse(docId).success) return null
  const row = (await packageRows(owner, docId, false).limit(1))[0]
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
