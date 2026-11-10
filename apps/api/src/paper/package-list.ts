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
import { readWordPackage } from "./package-store.js"

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
    createdAt: when,
    updatedAt: when,
  })
}

function mintedRows(owner: string, docId?: string) {
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
        eq(paperPackageHeads.canvasProfile, PAPER_CANVAS_PROFILE),
        docId ? eq(paperPackageHeads.docId, docId) : undefined
      )
    )
}

export async function listMintedPackagePapers(owner: string) {
  return (await mintedRows(owner)).map(packagePaper)
}

export async function mintedPackagePaper(owner: string, docId: string) {
  if (!docIdSchema.safeParse(docId).success) return null
  const row = (await mintedRows(owner, docId).limit(1))[0]
  return row ? packagePaper(row) : null
}

export async function mintedPackageOutline(
  owner: string,
  docId: string,
  blockIds: readonly string[] | undefined,
  maxChars: number
) {
  if (!(await mintedPackagePaper(owner, docId))) return null
  const page = await readWordPackage(owner, { docId })
  const selected = new Set(blockIds ?? [])
  const lines = [`Saved revision ${page.revision}`]
  for (const region of page.regions) {
    if (region.kind === "editable") {
      const mark = selected.has(region.targetId) ? ">> " : ""
      lines.push(`${mark}[${region.targetId}] ${region.text}`)
    } else {
      lines.push(`[locked] ${region.text}`)
    }
  }
  let outline = lines.join("\n")
  let truncated = false
  if (outline.length > maxChars) {
    outline = outline.slice(0, maxChars)
    truncated = true
  }
  return { revision: 0, outline, truncated }
}

export function missingDocument(error: unknown) {
  return error instanceof CommandError && error.code === ERROR_CODES.NOT_FOUND
}
