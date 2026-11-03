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

export function readStoredPaper(row: PaperRow): PaperDocument {
  const seeded = paperDocumentSchema.safeParse(row.crdtDocument)
  if (seeded.success) return seeded.data
  const upgraded = upgradeStoredPaper(row.kind, row.document)
  if (!upgraded.ok) {
    throw new CommandError(ERROR_CODES.CONFLICT, upgraded.message)
  }
  return upgraded.document
}

export function toPaper(row: PaperRow): PaperView {
  return {
    id: parsePaperId(row.id),
    name: row.name,
    kind: row.kind,
    templateId: row.templateId as PaperView["templateId"],
    status: row.status,
    document: row.document as PaperView["document"],
    paper: readStoredPaper(row),
    contentVersion: row.contentVersion,
    checks: row.checks ?? [],
    pageChoice: row.pageChoice,
    sourceFileId: row.sourceFileId ? parseFileId(row.sourceFileId) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    isFavorite: row.isFavorite,
  }
}
