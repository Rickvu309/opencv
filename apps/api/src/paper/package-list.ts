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
import { open } from "./word/document.js"

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
  maxChars: number
) {
  if (!(await ownedPackagePaper(owner, docId))) return null
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
  const word = await open(owner, {
    kind: "read",
    doc: docId,
    at: page.revision,
  })
  if (!("refused" in word)) {
    lines.push("Word lines for setText, insert and delete:")
    for (const line of word.paragraphs)
      lines.push(
        line.held
          ? `[held] ${line.text}`
          : `[line ${line.handle}] ${line.text === "" ? "(empty line)" : line.text}`
      )
  }
  let outline = lines.join("\n")
  let truncated = false
  if (outline.length > maxChars) {
    outline = outline.slice(0, maxChars)
    truncated = true
  }
  return { revision: page.revision, outline, truncated }
}

export function missingDocument(error: unknown) {
  return error instanceof CommandError && error.code === ERROR_CODES.NOT_FOUND
}
