import type { ReversalExpect } from "@workspace/domain"
import { and, eq, gt, isNull, notLike, or } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { getDb } from "../db/context.js"
import { activity } from "../db/schema.js"

export async function staleExpectation(
  read: (query: string, input: unknown) => Promise<unknown>,
  expect: ReversalExpect | null
): Promise<string | null> {
  if (!expect) return null
  let current: unknown
  try {
    current = await read(expect.query, expect.input)
  } catch {
    return expect.skipped
  }
  const fields = (current ?? {}) as Record<string, unknown>
  const required = Object.entries(expect.matches)
  if (required.length === 0) return expect.skipped
  const unchanged = required.every(
    ([key, value]) => JSON.stringify(fields[key]) === JSON.stringify(value)
  )
  return unchanged ? null : expect.skipped
}

type UndoRow = {
  userId: string
  id: string
  command: string
  subjectKind: string
  subjectId: string
  reversalExpect: ReversalExpect | null
}

const undone = alias(activity, "undone")

export const UNDO_KEY_PREFIX = "undo:"

export const undoKeyFor = (activityId: string) =>
  `${UNDO_KEY_PREFIX}${activityId}`

export const isUndoRow = (row: { idempotencyKey: string | null }) =>
  row.idempotencyKey?.startsWith(UNDO_KEY_PREFIX) ?? false

export const undoOfUndo = (row: { idempotencyKey: string | null }) =>
  isUndoRow(row)
    ? "An Undo cannot be undone. Make the change again instead."
    : null

export async function laterLiveAction(row: UndoRow): Promise<string | null> {
  if (!row.reversalExpect) return null
  const later = await getDb()
    .select({ id: activity.id })
    .from(activity)
    .innerJoin(undone, eq(undone.id, row.id))
    .where(
      and(
        eq(activity.userId, row.userId),
        eq(activity.command, row.command),
        eq(activity.subjectKind, row.subjectKind),
        eq(activity.subjectId, row.subjectId),
        gt(activity.createdAt, undone.createdAt),
        isNull(activity.undoneAt),
        or(
          isNull(activity.idempotencyKey),
          notLike(activity.idempotencyKey, `${UNDO_KEY_PREFIX}%`)
        )
      )
    )
    .limit(1)
  return later.length > 0 ? row.reversalExpect.skipped : null
}
