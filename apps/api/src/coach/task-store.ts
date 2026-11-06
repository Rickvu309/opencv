import { and, eq, sql } from "drizzle-orm"
import { getDb, savepoint, transaction } from "../db/context.js"
import {
  coachTasks,
  taskEvents,
  taskCheckpoints,
  toolIntents,
} from "../db/schema.js"
import {
  closeTaskApprovals,
  lockTask,
  withTaskFence,
} from "../registry/task-fence.js"
import type { Checkpoint, Intent, TaskLease } from "./task-types.js"

export { runIntent } from "./task-effects.js"

export { inputHash } from "../registry/receipt.js"
import { inputHash } from "../registry/receipt.js"

export function intentKey(taskId: string, step: number, slot: number) {
  return `coach:${taskId}:${step}:${slot}`
}

export function claim(input: { workerId: string; leaseMs: number }) {
  if (!Number.isSafeInteger(input.leaseMs) || input.leaseMs <= 0)
    throw new Error("Invalid lease duration")
  return transaction(async () => {
    const [task] = await getDb()
      .select()
      .from(coachTasks)
      .where(
        sql`(${coachTasks.state} = 'queued' or (${coachTasks.state} in ('running','cancelling') and (${coachTasks.leaseUntil} is null or ${coachTasks.leaseUntil} <= clock_timestamp()))) and ${coachTasks.availableAt} <= clock_timestamp()`
      )
      .orderBy(coachTasks.availableAt, coachTasks.id)
      .limit(1)
      .for("update", { skipLocked: true })
    if (!task) return null
    const [row] = await getDb()
      .update(coachTasks)
      .set({
        leaseOwner: input.workerId,
        leaseEpoch: sql`${coachTasks.leaseEpoch} + 1`,
        leaseUntil: sql`clock_timestamp() + ${input.leaseMs} * interval '1 millisecond'`,
        state: task.cancelRequestedAt ? "cancelling" : "running",
        attempt: sql`${coachTasks.attempt} + 1`,
      })
      .where(eq(coachTasks.id, task.id))
      .returning()
    if (!row) throw new Error("Claim failed")
    return {
      row,
      lease: {
        taskId: row.id,
        workerId: input.workerId,
        epoch: row.leaseEpoch,
      },
    }
  })
}

export function renew(lease: TaskLease, leaseMs: number) {
  if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0)
    throw new Error("Invalid lease duration")
  return transaction(() =>
    savepoint(async () => {
      const task = await lockTask(lease, true)
      const renewed = await getDb()
        .update(coachTasks)
        .set({
          leaseUntil: sql`clock_timestamp() + ${leaseMs} * interval '1 millisecond'`,
        })
        .where(
          and(
            eq(coachTasks.id, task.id),
            sql`${coachTasks.leaseUntil} > clock_timestamp()`,
            sql`${coachTasks.deadlineAt} > clock_timestamp()`
          )
        )
        .returning({ id: coachTasks.id })
      if (!renewed.length) throw new Error("Task lease lost")
      return task.cancelRequestedAt ? "cancelling" : "renewed"
    })
  )
}

export function append(
  lease: TaskLease,
  event: { kind: string; payload: unknown; step?: number; logicalKey?: string }
) {
  return withTaskFence(
    lease,
    async (task) => {
      const [row] = await getDb()
        .insert(taskEvents)
        .values({
          taskId: task.id,
          seq: task.nextSeq,
          epoch: lease.epoch,
          attempt: task.attempt,
          ...event,
        })
        .returning()
      await getDb()
        .update(coachTasks)
        .set({ nextSeq: task.nextSeq + 1 })
        .where(eq(coachTasks.id, task.id))
      return row!
    },
    true
  )
}

export function persistStep(
  lease: TaskLease,
  checkpoint: Checkpoint,
  intents: readonly Intent[]
) {
  return withTaskFence(lease, async (task) => {
    if (intents.length && !task.toolsAllowed)
      throw new Error("Task tools disabled")
    if (
      checkpoint.completedStep >= task.maxSteps ||
      checkpoint.usage.inputTokens + checkpoint.usage.outputTokens >
        task.maxTokens
    )
      throw new Error("Task budget exceeded")
    const [prior] = await getDb()
      .select()
      .from(taskCheckpoints)
      .where(
        and(
          eq(taskCheckpoints.taskId, task.id),
          eq(taskCheckpoints.completedStep, checkpoint.completedStep),
          eq(taskCheckpoints.phase, checkpoint.phase)
        )
      )
    if (prior) {
      if (
        inputHash({ ...checkpoint, intents }) !==
        inputHash({
          completedStep: prior.completedStep,
          phase: prior.phase,
          modelMessages: prior.modelMessages,
          observedRevisions: prior.observedRevisions,
          usage: prior.usage,
          requestManifest: prior.requestManifest,
          intents:
            checkpoint.phase === "decision"
              ? await storedIntents(task.id, checkpoint.completedStep)
              : [],
        })
      )
        throw new Error("Decision mismatch")
      return
    }
    const [latest] = await getDb()
      .select()
      .from(taskCheckpoints)
      .where(
        and(
          eq(taskCheckpoints.taskId, task.id),
          eq(taskCheckpoints.version, task.checkpointVersion)
        )
      )
    if (
      checkpoint.completedStep !==
        (latest
          ? latest.completedStep + (checkpoint.phase === "decision" ? 1 : 0)
          : 0) ||
      (checkpoint.phase === "results" && latest?.phase !== "decision")
    )
      throw new Error("Checkpoint order mismatch")
    if (
      latest &&
      (checkpoint.usage.inputTokens < latest.usage.inputTokens ||
        checkpoint.usage.outputTokens < latest.usage.outputTokens)
    )
      throw new Error("Task usage must be cumulative")
    const previousPending = await getDb()
      .select()
      .from(toolIntents)
      .where(
        and(
          eq(toolIntents.taskId, task.id),
          sql`${toolIntents.state} in ('planned','proposed')`
        )
      )
    if (previousPending.length) throw new Error("Unresolved intents")
    if (checkpoint.phase === "results" && intents.length)
      throw new Error("Results cannot introduce intents")
    for (const [slot, intent] of intents.entries()) {
      if (
        intent.step !== checkpoint.completedStep ||
        intent.slot !== slot ||
        intent.intentKey !== intentKey(task.id, intent.step, slot) ||
        intent.inputHash !== inputHash(intent.input)
      )
        throw new Error("Intent identity mismatch")
      await getDb()
        .insert(toolIntents)
        .values({ ...intent, taskId: task.id })
    }
    const unresolved = await getDb()
      .select()
      .from(toolIntents)
      .where(
        and(
          eq(toolIntents.taskId, task.id),
          sql`${toolIntents.state} in ('planned','proposed')`
        )
      )
    if (checkpoint.phase === "results" && unresolved.length)
      throw new Error("Unresolved intents")
    const version = task.checkpointVersion + 1
    await getDb()
      .insert(taskCheckpoints)
      .values({
        ...checkpoint,
        taskId: task.id,
        version,
        attempt: task.attempt,
      })
    await getDb()
      .update(coachTasks)
      .set({ checkpointVersion: version })
      .where(eq(coachTasks.id, task.id))
  })
}

async function storedIntents(taskId: string, step: number): Promise<Intent[]> {
  const rows = await getDb()
    .select()
    .from(toolIntents)
    .where(and(eq(toolIntents.taskId, taskId), eq(toolIntents.step, step)))
    .orderBy(toolIntents.slot)
  return rows.map(
    ({
      step,
      slot,
      intentKey,
      providerToolUseId,
      operation,
      operationVersion,
      input,
      inputHash,
      observedRevisions,
      kind,
    }) => ({
      step,
      slot,
      intentKey,
      providerToolUseId,
      operation,
      operationVersion,
      input,
      inputHash,
      observedRevisions,
      kind,
    })
  )
}

export function requestCancel(taskId: string, ownerId: string) {
  return transaction(async () => {
    const [task] = await getDb()
      .select()
      .from(coachTasks)
      .where(and(eq(coachTasks.id, taskId), eq(coachTasks.ownerId, ownerId)))
      .for("update")
    if (!task || ["cancelled", "succeeded", "failed"].includes(task.state))
      return
    await getDb()
      .update(coachTasks)
      .set({
        cancelRequestedAt: sql`coalesce(${coachTasks.cancelRequestedAt}, clock_timestamp())`,
        state: "cancelling",
      })
      .where(eq(coachTasks.id, taskId))
  })
}

export function finalize(
  lease: TaskLease,
  state: "cancelled" | "succeeded" | "failed"
) {
  return transaction(() =>
    savepoint(async () => {
      const [existing] = await getDb()
        .select()
        .from(coachTasks)
        .where(eq(coachTasks.id, lease.taskId))
        .for("update")
      if (
        existing?.state === state &&
        existing.leaseEpoch === lease.epoch &&
        existing.leaseOwner === lease.workerId
      )
        return
      const task = await lockTask(lease, true, state !== "succeeded")
      if (task.cancelRequestedAt && state !== "cancelled")
        throw new Error("Task cancelled")
      const unresolved = await getDb()
        .select()
        .from(toolIntents)
        .where(
          and(
            eq(toolIntents.taskId, task.id),
            sql`${toolIntents.state} in ('planned', 'proposed')`
          )
        )
      if (state === "succeeded" && unresolved.length)
        throw new Error("Unresolved intents")
      if (state !== "succeeded") {
        await getDb()
          .update(toolIntents)
          .set({
            state: "cancelled",
            publicResult: { cancelled: true },
            finishedAt: sql`clock_timestamp()`,
          })
          .where(
            and(
              eq(toolIntents.taskId, task.id),
              sql`${toolIntents.state} in ('planned', 'proposed')`
            )
          )
        await closeTaskApprovals(task.id)
      }
      await getDb().insert(taskEvents).values({
        taskId: task.id,
        seq: task.nextSeq,
        epoch: lease.epoch,
        attempt: task.attempt,
        kind: "state",
        payload: { state },
        logicalKey: "terminal",
      })
      const updated = await getDb()
        .update(coachTasks)
        .set({
          state,
          nextSeq: task.nextSeq + 1,
          finishedAt: sql`clock_timestamp()`,
          cancelProcessedAt:
            state === "cancelled" ? sql`clock_timestamp()` : null,
        })
        .where(
          and(
            eq(coachTasks.id, task.id),
            sql`${coachTasks.leaseUntil} > clock_timestamp()`,
            state === "succeeded"
              ? sql`${coachTasks.deadlineAt} > clock_timestamp()`
              : sql`true`
          )
        )
        .returning({ id: coachTasks.id })
      if (!updated.length) throw new Error("Task lease lost")
    })
  )
}
