import { and, eq, sql } from "drizzle-orm"
import { getDb } from "../db/context.js"
import {
  coachTasks,
  coachUsage,
  pendingActions,
  taskEvents,
  toolIntents,
} from "../db/schema.js"
import { CommandError } from "../registry/errors.js"
import { ERROR_CODES } from "@workspace/domain"
import { inputHash } from "./task-store.js"

export async function lockTaskApproval(
  proposal: typeof pendingActions.$inferSelect,
  maintenance = false
) {
  if (!proposal.coachTaskId) return null
  const [task] = await getDb()
    .select()
    .from(coachTasks)
    .where(
      and(
        eq(coachTasks.id, proposal.coachTaskId),
        eq(coachTasks.ownerId, proposal.userId)
      )
    )
    .for("update")
  if (
    !task ||
    task.cancelRequestedAt ||
    ["cancelled", "succeeded", "failed"].includes(task.state)
  ) {
    if (maintenance) return null
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "This task confirmation requires an active task"
    )
  }
  if (!maintenance) {
    const [live] = await getDb()
      .select({ id: coachTasks.id })
      .from(coachTasks)
      .where(
        and(
          eq(coachTasks.id, task.id),
          sql`${coachTasks.deadlineAt} > clock_timestamp()`
        )
      )
    if (!live)
      throw new CommandError(ERROR_CODES.PENDING_EXPIRED, "This task expired")
  }
  const [intent] = await getDb()
    .select()
    .from(toolIntents)
    .where(
      and(
        eq(toolIntents.taskId, task.id),
        eq(toolIntents.intentKey, proposal.coachIntentKey ?? "")
      )
    )
    .for("update")
  if (
    !intent ||
    intent.proposalId !== proposal.id ||
    intent.operation !== proposal.command ||
    intent.inputHash !== inputHash(proposal.input) ||
    intent.inputHash !== inputHash(intent.input)
  )
    throw new CommandError(
      ERROR_CODES.CONFLICT,
      "Task proposal identity mismatch"
    )
  const [usage] = await getDb()
    .select({ id: coachUsage.id })
    .from(coachUsage)
    .where(eq(coachUsage.coachTaskId, task.id))
  if (!usage) throw new Error("Task usage missing")
  return { task, intent, turnId: usage.id }
}

export async function resolveTaskApproval(
  locked: NonNullable<Awaited<ReturnType<typeof lockTaskApproval>>>,
  state: "committed" | "denied" | "expired",
  result: unknown,
  activityId: string | null = null
) {
  const { task, intent } = locked
  if (intent.state !== "proposed") return
  await getDb()
    .update(toolIntents)
    .set({
      state: state === "expired" ? "denied" : state,
      publicResult: result,
      activityId,
      finishedAt: sql`clock_timestamp()`,
    })
    .where(
      and(
        eq(toolIntents.taskId, task.id),
        eq(toolIntents.intentKey, intent.intentKey)
      )
    )
  await getDb()
    .insert(taskEvents)
    .values({
      taskId: task.id,
      seq: task.nextSeq,
      epoch: task.leaseEpoch,
      attempt: task.attempt,
      step: intent.step,
      kind: "actionResolved",
      logicalKey: `${intent.intentKey}:resolved`,
      payload: { operation: intent.operation, result },
    })
  const remaining = await getDb()
    .select({ id: toolIntents.intentKey })
    .from(toolIntents)
    .where(
      and(eq(toolIntents.taskId, task.id), eq(toolIntents.state, "proposed"))
    )
  await getDb()
    .update(coachTasks)
    .set({
      nextSeq: task.nextSeq + 1,
      ...(remaining.length === 0 && task.state === "waitingApproval"
        ? { state: "queued" as const, availableAt: sql`clock_timestamp()` }
        : {}),
    })
    .where(eq(coachTasks.id, task.id))
}
