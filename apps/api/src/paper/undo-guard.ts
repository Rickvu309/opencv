import { and, asc, eq, inArray } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import { blockedReason, type EditRow } from "./undo-rules.js"

export type UndoQuestion = { docId: string; editId: string }

export async function undoBlockedReasons(
  userId: string,
  questions: readonly UndoQuestion[]
): Promise<(string | null)[]> {
  const docIds = [...new Set(questions.map((question) => question.docId))]
  if (docIds.length === 0) return []
  const rows = await getDb()
    .select({
      paperId: paperDocUpdates.paperId,
      seq: paperDocUpdates.seq,
      origin: paperDocUpdates.origin,
      editId: paperDocUpdates.editId,
      basedOn: paperDocUpdates.basedOn,
      touched: paperDocUpdates.touched,
    })
    .from(paperDocUpdates)
    .innerJoin(paperDocs, eq(paperDocs.id, paperDocUpdates.paperId))
    .where(
      and(
        eq(paperDocs.userId, userId),
        inArray(paperDocUpdates.paperId, docIds),
        inArray(paperDocUpdates.origin, ["coach", "revert"])
      )
    )
    .orderBy(asc(paperDocUpdates.seq))
  const byDoc = new Map<string, EditRow[]>()
  for (const row of rows) {
    const list = byDoc.get(row.paperId) ?? []
    list.push(row)
    byDoc.set(row.paperId, list)
  }
  return questions.map((question) => {
    const known = byDoc.get(question.docId)
    if (!known) return "This document is gone"
    return blockedReason(known, question.editId)
  })
}
