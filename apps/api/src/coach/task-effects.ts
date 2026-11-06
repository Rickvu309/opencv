import { coachActor } from "@workspace/domain"
import { and, eq, sql } from "drizzle-orm"
import { getDb } from "../db/context.js"
import { coachUsage, toolIntents } from "../db/schema.js"
import { withTaskFence } from "../registry/task-fence.js"
import type { Registry } from "../registry/registry.js"
import { append, inputHash, intentKey } from "./task-store.js"
import type { Intent, TaskLease } from "./task-types.js"

export function runIntent(
  lease: TaskLease,
  intent: Intent,
  registry: Registry
) {
  return withTaskFence(lease, async (task) => {
    const [stored] = await getDb()
      .select()
      .from(toolIntents)
      .where(
        and(
          eq(toolIntents.taskId, task.id),
          eq(toolIntents.step, intent.step),
          eq(toolIntents.slot, intent.slot)
        )
      )
    if (
      !stored ||
      intent.intentKey !== intentKey(task.id, intent.step, intent.slot) ||
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
    if (stored.state !== "planned") return stored.publicResult
    const [usage] = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, task.id))
    if (!usage) throw new Error("Task usage missing")
    const actor = coachActor(task.ownerId, task.chatId, usage.id)
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
