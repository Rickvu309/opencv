import {
  ERROR_CODES,
  paperDocumentSchema,
  parseFileId,
  parsePaperId,
  upgradeStoredPaper,
  type PaperDocument,
  type PaperView,
} from "@workspace/domain"

import { paperDocs } from "../db/schema.js"
import { CommandError } from "../registry/errors.js"

type PaperRow = typeof paperDocs.$inferSelect

function iso(value: Date) {
  return value.toISOString()
}

export function tryReadStoredPaper(row: PaperRow): PaperDocument | null {
  const seeded = paperDocumentSchema.safeParse(row.crdtDocument)
  if (seeded.success && seeded.data.kind === row.kind) return seeded.data
  const upgraded = upgradeStoredPaper(row.kind, row.document)
  if (!upgraded.ok || upgraded.document.kind !== row.kind) return null
  return upgraded.document
}

export function readStoredPaper(row: PaperRow): PaperDocument {
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
  paper: PaperDocument = readStoredPaper(row)
): PaperView {
  return {
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
