import {
  storedPaperPhotoIds,
  type StoredPaperDocument,
} from "@workspace/domain/paper-doc"
import { loadYDoc, updateSince } from "@workspace/paper-crdt"
import { and, asc, eq, lt } from "drizzle-orm"

import { getDb } from "../../db/context.js"
import { paperDocUpdates, paperDocs } from "../../db/schema.js"

export const COMPACT_EVERY_SEQ = 64
export const COACH_UNDO_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
export const FORK_WINDOW_MS = 60 * 60 * 1000

type Stamp = {
  readonly seq: number
  readonly origin: string
  readonly editId: string | null
  readonly createdAt: Date
  readonly update: Uint8Array
}

type FoldBase = {
  readonly base: Uint8Array
  readonly baseSeq: number
}

export function droppedPhotoIds(
  previous: unknown,
  next: StoredPaperDocument
): string[] {
  const after = new Set(storedPaperPhotoIds(next))
  return storedPaperPhotoIds(previous).filter((id) => !after.has(id))
}

export function compactionHorizon(
  rows: readonly Omit<Stamp, "update">[],
  now: Date
): number | null {
  const coachLimit = now.getTime() - COACH_UNDO_WINDOW_MS
  const forkLimit = now.getTime() - FORK_WINDOW_MS
  const reverted = new Set(
    rows.filter((row) => row.origin === "revert").map((row) => row.editId)
  )
  let coachSeq: number | null = null
  let forkSeq: number | null = null
  for (const row of rows) {
    const at = row.createdAt.getTime()
    if (
      row.origin === "coach" &&
      !reverted.has(row.editId) &&
      at >= coachLimit &&
      (coachSeq === null || row.seq < coachSeq)
    ) {
      coachSeq = row.seq
    }
    if (at >= forkLimit && (forkSeq === null || row.seq < forkSeq)) {
      forkSeq = row.seq
    }
  }
  if (coachSeq === null) return forkSeq
  if (forkSeq === null) return coachSeq
  return Math.min(coachSeq, forkSeq)
}

async function stampedRows(paperId: string): Promise<Stamp[]> {
  return getDb()
    .select({
      seq: paperDocUpdates.seq,
      origin: paperDocUpdates.origin,
      editId: paperDocUpdates.editId,
      createdAt: paperDocUpdates.createdAt,
      update: paperDocUpdates.update,
    })
    .from(paperDocUpdates)
    .where(eq(paperDocUpdates.paperId, paperId))
    .orderBy(asc(paperDocUpdates.seq))
}

export async function foldSettledLog(
  paperId: string,
  entry: FoldBase,
  now = new Date()
): Promise<{ base: Buffer; baseSeq: number } | null> {
  const rows = await stampedRows(paperId)
  const horizon = compactionHorizon(rows, now)
  if (horizon === null) return null
  const folded = rows.filter(
    (row) => row.seq < horizon && row.seq > entry.baseSeq
  )
  if (folded.length === 0) return null
  const foldedDoc = loadYDoc(
    entry.base,
    folded.map((row) => row.update)
  )
  try {
    const snapshot = updateSince(foldedDoc, new Uint8Array())
    if (!snapshot) return null
    const base = Buffer.from(snapshot)
    const baseSeq = horizon - 1
    await getDb()
      .update(paperDocs)
      .set({ crdtBase: base, crdtBaseSeq: baseSeq })
      .where(eq(paperDocs.id, paperId))
    await getDb()
      .delete(paperDocUpdates)
      .where(
        and(
          eq(paperDocUpdates.paperId, paperId),
          lt(paperDocUpdates.seq, horizon)
        )
      )
    return { base, baseSeq }
  } finally {
    foldedDoc.destroy()
  }
}
