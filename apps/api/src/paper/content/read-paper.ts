import {
  ERROR_CODES,
  parseFileId,
  parsePaperId,
} from "@workspace/domain/kernel"
import {
  blankCv,
  blankLetter,
  paperPreviewLines,
  richPaperDocumentSchema,
  type PaperView,
  type NativeWriter,
} from "@workspace/domain/paper-doc"

import { paperDocs } from "../../db/schema.js"
import { CommandError } from "../../platform/errors.js"
import { admitDocument } from "./native-admission.js"

type PaperRow = typeof paperDocs.$inferSelect

function iso(value: Date) {
  return value.toISOString()
}

export function tryReadRichPaper(row: PaperRow) {
  const stored = richPaperDocumentSchema.safeParse(row.crdtDocument)
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
  const rich = readRichPaper(row)
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
    preview: paperPreviewLines(rich),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    isFavorite: row.isFavorite,
  }
}
