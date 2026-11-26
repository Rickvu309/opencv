import { coachActor } from "@workspace/domain/kernel"
import { and, eq, sql } from "drizzle-orm"
import { getDb } from "../db/context.js"
import { coachUsage, toolIntents } from "../db/schema.js"
import { withOwnedTaskFence } from "../registry/task-fence.js"
import type { Registry } from "../registry/registry.js"
import { append, inputHash, intentKey } from "./task-store.js"
import type { Intent, Task, TaskLease } from "./task-types.js"

async function storedIntent(taskId: string, intent: Intent) {
  const [stored] = await getDb()
    .select()
    .from(toolIntents)
    .where(
      and(
        eq(toolIntents.taskId, taskId),
        eq(toolIntents.step, intent.step),
        eq(toolIntents.slot, intent.slot)
      )
    )
  if (
    !stored ||
    intent.intentKey !== intentKey(taskId, intent.step, intent.slot) ||
    stored.intentKey !== intent.intentKey ||
    stored.inputHash !== inputHash(intent.input) ||
    stored.inputHash !== inputHash(stored.input) ||
    inputHash(stored.observedRevisions) !==
      inputHash(intent.observedRevisions) ||
    stored.inputHash !== intent.inputHash ||
    stored.operation !== intent.operation ||
    stored.operationVersion !== intent.operationVersion ||
    stored.kind !== intent.kind ||
    stored.providerToolUseId !== intent.providerToolUseId
  )
    throw new Error("Intent identity mismatch")
  return stored
}

async function taskActor(task: Pick<Task, "id" | "ownerId" | "chatId">) {
  const [usage] = await getDb()
    .select()
    .from(coachUsage)
    .where(eq(coachUsage.coachTaskId, task.id))
  if (!usage || usage.userId !== task.ownerId || usage.chatId !== task.chatId)
    throw new Error("Task usage missing or mismatched")
  return coachActor(task.ownerId, task.chatId, usage.id)
}

export async function runIntent(
  lease: TaskLease,
  intent: Intent,
  registry: Registry
) {
  return withOwnedTaskFence(lease, async (task) => {
    const stored = await storedIntent(task.id, intent)
    if (stored.state !== "planned") return stored.publicResult
    const actor = await taskActor(task)
    const executed =
      intent.kind === "command"
        ? await registry.executeTask(lease, {
            name: stored.operation,
            input: stored.input,
            actor,
            idempotencyKey: stored.intentKey,
          })
        : null
    const result = executed
      ? {
          pending: executed.pending,
          pendingActionId: executed.pendingActionId ?? null,
          output: executed.output ?? null,
          activityId: executed.activityId,
          summary: executed.summary ?? null,
        }
      : { output: await registry.read(stored.operation, stored.input, actor) }
    await getDb()
      .update(toolIntents)
      .set({
        state: executed?.pending ? "proposed" : executed ? "committed" : "read",
        proposalId: executed?.pendingActionId,
        activityId: executed?.activityId,
        publicResult: result,
        finishedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(toolIntents.taskId, task.id),
          eq(toolIntents.step, intent.step),
          eq(toolIntents.slot, intent.slot)
        )
      )
    await append(lease, {
      kind: "action",
      payload: { operation: intent.operation, result },
      step: intent.step,
      logicalKey: intent.intentKey,
    })
    return result
  })
}
