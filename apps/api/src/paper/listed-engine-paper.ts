import { parseFileId, parsePaperId } from "@workspace/domain/kernel"
import {
  blankCv,
  blankLetter,
  layoutPageSchema,
  type PaperView,
} from "@workspace/domain/paper-doc"

import { paperDocs } from "../db/schema.js"
import { NEW_ENGINE } from "./log/index.js"

type PaperRow = typeof paperDocs.$inferSelect

export function isEnginePaper(row: PaperRow) {
  return row.engine === NEW_ENGINE
}

export function toListedEnginePaper(row: PaperRow): PaperView {
  const stored = row.firstPage
    ? layoutPageSchema.safeParse(row.firstPage)
    : null
  return {
    id: parsePaperId(row.id),
    name: row.name,
    kind: row.kind,
    templateId: row.templateId as PaperView["templateId"],
    status: row.status,
    paper: row.kind === "cv" ? blankCv() : blankLetter(),
    contentVersion: row.headVersion,
    checks: row.checks ?? [],
    pageChoice: row.pageChoice,
    sourceFileId: row.sourceFileId ? parseFileId(row.sourceFileId) : null,
    ...(stored?.success ? { firstPage: stored.data } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isFavorite: row.isFavorite,
  }
}
