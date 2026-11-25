import {
  ERROR_CODES,
  blankCv,
  blankLetter,
  storedPaperDocumentSchema,
  parseFileId,
  parsePaperId,
  type PaperView,
  type NativeWriter,
} from "@workspace/domain"

import { paperDocs } from "../db/schema.js"
import { CommandError } from "../platform/errors.js"
import { admitDocument } from "./native-admission.js"

type PaperRow = typeof paperDocs.$inferSelect

function iso(value: Date) {
  return value.toISOString()
}

export function needsRichEditor() {
  return new CommandError(
    ERROR_CODES.CONFLICT,
    "This document needs the rich Paper editor. Nothing was changed."
  )
}

export function tryReadRichPaper(row: PaperRow) {
  const stored = storedPaperDocumentSchema.safeParse(row.crdtDocument)
  return stored.success && stored.data.kind === row.kind ? stored.data : null
}

export function readRichPaper(row: PaperRow) {
  const rich = tryReadRichPaper(row)
  if (!rich)
    throw new CommandError(
      ERROR_CODES.INTERNAL_ERROR,
      "This paper cannot be read"
    )
  return rich
}

export function isRichPaper(row: PaperRow) {
  return tryReadRichPaper(row) !== null
}

export function toListedPaper(row: PaperRow, writer?: NativeWriter): PaperView {
  admitDocument(readRichPaper(row), writer)
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
