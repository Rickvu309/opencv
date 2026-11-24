import {
  controlContract,
  type ActivityRow,
  type PendingActionRow,
} from "@workspace/domain"

import { bindCommands } from "./bind.js"
import type { Registry } from "./registry.js"

type ActivityDbRow = {
  createdAt: Date
  undoneAt: Date | null
} & Omit<ActivityRow, "createdAt" | "undoneAt">

function toActivityRow(row: ActivityDbRow): ActivityRow {
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

function toPendingActionRow(
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

const registeredOn = new WeakSet<Registry>()

export function registerControl(registry: Registry) {
  if (registeredOn.has(registry)) return
  registeredOn.add(registry)
  bindCommands(registry, controlContract, {
    "actions.approve": {
      handler: async (input, actor) => {
        const row = await registry.approve(actor.userId, input.pendingActionId)
        return row ? toActivityRow(row) : null
      },
      reversal: () => null,
      activity: () => null,
    },
    "actions.deny": {
      handler: async (input, actor) =>
        toPendingActionRow(
          await registry.deny(actor.userId, input.pendingActionId)
        ),
      reversal: () => null,
      activity: () => null,
    },
    "activity.undo": {
      handler: async (input, actor) =>
        toActivityRow(await registry.undo(actor.userId, input.activityId)),
      reversal: () => null,
      activity: () => null,
    },
  })
}
