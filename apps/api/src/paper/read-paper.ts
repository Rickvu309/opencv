import {
  ERROR_CODES,
  blankCv,
  blankLetter,
  paperDocumentSchema,
  storedPaperDocumentSchema,
  paperSharedViewSchema,
  parseFileId,
  parsePaperId,
  type PaperDocument,
  type PaperSharedView,
  type PaperView,
  type NativeWriter,
} from "@workspace/domain"

import { paperDocs } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import { admitDocument, basisOf } from "./native-admission.js"

type PaperRow = typeof paperDocs.$inferSelect

function iso(value: Date) {
  return value.toISOString()
}

export function tryReadStoredPaper(row: PaperRow): PaperDocument | null {
  const seeded = paperDocumentSchema.safeParse(row.crdtDocument)
  if (!seeded.success || seeded.data.kind !== row.kind) return null
  return seeded.data
}

export function readStoredPaper(row: PaperRow): PaperDocument {
  const stored = storedPaperDocumentSchema.safeParse(row.crdtDocument)
  if (
    stored.success &&
    stored.data.version === 4 &&
    stored.data.schemaRevision === 2
  )
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This document needs the rich Paper editor. Nothing was changed."
    )
  const paper = tryReadStoredPaper(row)
  if (!paper) {
    throw new CommandError(
      ERROR_CODES.INTERNAL_ERROR,
      "This paper cannot be read"
    )
  }
  return paper
}

export function toPaper(
  row: PaperRow,
  paper: PaperDocument = readStoredPaper(row),
  writer?: NativeWriter
): PaperView {
  admitDocument(paper, writer)
  const nativeBasis = basisOf(paper, row.crdtEpoch ?? 1, row.contentVersion)
  return {
    ...(nativeBasis ? { nativeBasis } : {}),
    id: parsePaperId(row.id),
    name: row.name,
    kind: row.kind,
    templateId: row.templateId as PaperView["templateId"],
    status: row.status,
    paper,
    contentVersion: row.contentVersion,
    checks: row.checks ?? [],
    pageChoice: row.pageChoice,
    sourceFileId: row.sourceFileId ? parseFileId(row.sourceFileId) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    isFavorite: row.isFavorite,
  }
}

function richDocumentOf(row: PaperRow) {
  const stored = storedPaperDocumentSchema.safeParse(row.crdtDocument)
  return stored.success &&
    stored.data.version === 4 &&
    stored.data.schemaRevision === 2
    ? stored.data
    : null
}

export function isRichPaper(row: PaperRow) {
  return richDocumentOf(row) !== null
}

export function toListedPaper(row: PaperRow, writer?: NativeWriter): PaperView {
  const rich = richDocumentOf(row)
  if (!rich) return toPaper(row, undefined, writer)
  admitDocument(rich, writer)
  return {
    id: parsePaperId(row.id),
    name: row.name,
    kind: row.kind,
    templateId: row.templateId as PaperView["templateId"],
    status: row.status,
    paper: row.kind === "cv" ? blankCv() : blankLetter(),
    contentVersion: row.contentVersion,
    checks: row.checks ?? [],
    pageChoice: row.pageChoice,
    sourceFileId: row.sourceFileId ? parseFileId(row.sourceFileId) : null,
    format: "rich",
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    isFavorite: row.isFavorite,
  }
}

export function toSharedPaper(
  row: PaperRow,
  writer?: NativeWriter
): PaperSharedView {
  const paper = readStoredPaper(row)
  admitDocument(paper, writer)
  return paperSharedViewSchema.parse({
    id: row.id,
    name: row.name,
    kind: row.kind,
    templateId: row.templateId,
    paper: { ...paper, clashes: [] },
  })
}
