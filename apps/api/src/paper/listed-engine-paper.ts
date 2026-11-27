import { parseFileId, parsePaperId } from "@workspace/domain/kernel"
import {
  blankCv,
  blankLetter,
  type PaperView,
} from "@workspace/domain/paper-doc"

import { paperDocs } from "../db/schema.js"
import { NEW_ENGINE } from "./log/index.js"

type PaperRow = Omit<typeof paperDocs.$inferSelect, "firstPage">

export function isEnginePaper(row: Pick<PaperRow, "engine">) {
  return row.engine === NEW_ENGINE
}

export function toListedEnginePaper(row: PaperRow): PaperView {
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
    engine: NEW_ENGINE,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isFavorite: row.isFavorite,
  }
}
