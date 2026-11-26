import { parsePaperId } from "@workspace/domain/kernel"
import {
  blankCv,
  blankLetter,
  paperViewSchema,
  type PaperView,
} from "@workspace/domain/paper-doc"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { getDb } from "../../db/context.js"
import { paperPackageHeads, paperPackageVersions } from "../../db/schema.js"

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
