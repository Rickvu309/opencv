import { and, eq, inArray } from "drizzle-orm"

import { getDb } from "../db/context.js"
import { activity, pendingActions } from "../db/schema.js"
import type { ExecuteResult } from "./registry.js"

export type TurnReceipt = {
  turnId: string
  name: string
  result: ExecuteResult
}

type ActivityRow = typeof activity.$inferSelect

export function replay(row: ActivityRow): ExecuteResult {
  return {
    pending: false,
    output: row.result,
    activityId: row.id,
    reversal: row.reversalCommand
      ? { command: row.reversalCommand, input: row.reversalInput }
      : null,
    detail: row.detail,
    summary: row.summary,
  }
}

export function replayStored(result: unknown): ExecuteResult {
  return {
    pending: false,
    output: result,
    activityId: null,
    reversal: null,
  }
}

export async function readTurnReceipts(
  userId: string,
  turnIds: string[]
): Promise<TurnReceipt[]> {
  if (turnIds.length === 0) return []
  const [edits, proposals] = await Promise.all([
    getDb()
      .select()
      .from(activity)
      .where(
        and(eq(activity.userId, userId), inArray(activity.turnId, turnIds))
      ),
    getDb()
      .select()
      .from(pendingActions)
      .where(
        and(
          eq(pendingActions.userId, userId),
          inArray(pendingActions.turnId, turnIds)
        )
      ),
  ])
  const dated = [
    ...edits.map((row) => ({
      at: row.createdAt.getTime(),
      id: row.id,
      receipt: {
        turnId: row.turnId!,
        name: row.command,
        result: replay(row),
      },
    })),
    ...proposals.map((row) => ({
      at: row.createdAt.getTime(),
      id: row.id,
      receipt: {
        turnId: row.turnId!,
        name: row.command,
        result: {
          pending: true,
          pendingActionId: row.id,
          summary: row.summary,
          command: row.command,
          activityId: null,
          reversal: null,
        } satisfies ExecuteResult,
      },
    })),
  ]
  return dated
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .map((entry) => entry.receipt)
}
