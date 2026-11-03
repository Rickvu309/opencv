import type { ExecuteResult } from "./registry.js"
import type { activity } from "../db/schema.js"

type ActivityRow = typeof activity.$inferSelect

export function replay(row: ActivityRow): ExecuteResult {
  return {
    pending: false,
    output: row.result,
    activityId: row.id,
    reversal: row.reversalCommand
      ? {
          command: row.reversalCommand,
          input: row.reversalInput,
          ...(row.reversalExpect ? { expect: row.reversalExpect } : {}),
        }
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
