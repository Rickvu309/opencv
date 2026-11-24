import type { ActivityRow, PendingActionRow } from "@workspace/domain"

type ActivityDbRow = {
  createdAt: Date
  undoneAt: Date | null
} & Omit<ActivityRow, "createdAt" | "undoneAt">

export function toActivityRow(row: ActivityDbRow): ActivityRow {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
    command: row.command,
    subjectKind: row.subjectKind,
    subjectId: row.subjectId,
    summary: row.summary,
    detail: row.detail,
    result: row.result,
    reversalCommand: row.reversalCommand,
    reversalInput: row.reversalInput,
    reversalExpect: row.reversalExpect,
    undoneAt: row.undoneAt?.toISOString() ?? null,
    idempotencyKey: row.idempotencyKey,
    turnId: row.turnId,
  }
}

export function toPendingActionRow(
  row: { createdAt: Date } & Omit<PendingActionRow, "createdAt">
): PendingActionRow {
  return {
    id: row.id,
    userId: row.userId,
    chatId: row.chatId,
    command: row.command,
    input: row.input,
    summary: row.summary,
    status: row.status,
    turnId: row.turnId,
    delegateConnectionId: row.delegateConnectionId,
    createdAt: row.createdAt.toISOString(),
  }
}
