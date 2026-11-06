import { ERROR_CODES, type Actor } from "@workspace/domain"
import { CommandError } from "./errors.js"
import { inputHash } from "./receipt.js"
import type { ExecuteResult, StoredCommand } from "./registry-types.js"
import { and, eq, sql } from "drizzle-orm"
import {
  getDb,
  ownedTaskTransaction,
  savepoint,
  transaction,
} from "../db/context.js"
import {
  activity,
  idempotency,
  coachTasks,
  pendingActions,
} from "../db/schema.js"

export type TaskLease = Readonly<{
  taskId: string
  workerId: string
  epoch: number
}>

export async function lockTask(
  lease: TaskLease,
  allowCancel = false,
  allowDeadline = false
) {
  const [task] = await getDb()
    .select()
    .from(coachTasks)
    .where(eq(coachTasks.id, lease.taskId))
    .for("update")
  if (
    !task ||
    task.leaseOwner !== lease.workerId ||
    task.leaseEpoch !== lease.epoch ||
    !["running", "cancelling"].includes(task.state)
  )
    throw new Error("Task lease lost")
  const [live] = await getDb()
    .select({ id: coachTasks.id })
    .from(coachTasks)
    .where(
      and(
        eq(coachTasks.id, task.id),
        sql`${coachTasks.leaseUntil} > clock_timestamp()`,
        allowDeadline
          ? sql`true`
          : sql`${coachTasks.deadlineAt} > clock_timestamp()`
      )
    )
  if (!live || (!allowCancel && task.cancelRequestedAt))
    throw new Error("Task lease lost")
  return task
}

export function withTaskFence<T>(
  lease: TaskLease,
  effect: (task: Awaited<ReturnType<typeof lockTask>>) => Promise<T>,
  allowCancel = false
) {
  return transaction(() =>
    savepoint(async () => {
      const task = await lockTask(lease, allowCancel)
      const result = await effect(task)
      await lockTask(lease, allowCancel)
      return result
    })
  )
}

export function withOwnedTaskFence<T>(
  lease: TaskLease,
  effect: (task: Awaited<ReturnType<typeof lockTask>>) => Promise<T>
) {
  return ownedTaskTransaction(async () => {
    const task = await lockTask(lease)
    const result = await effect(task)
    await lockTask(lease)
    return result
  })
}

export async function closeTaskApprovals(taskId: string) {
  await getDb()
    .update(pendingActions)
    .set({ status: "denied" })
    .where(
      and(
        eq(pendingActions.coachTaskId, taskId),
        eq(pendingActions.status, "pending")
      )
    )
}

export function executeTaskCommand(
  lease: TaskLease,
  options: {
    name: string
    input: unknown
    actor: Actor
    idempotencyKey: string
  },
  command: StoredCommand | undefined,
  execute: (options: {
    name: string
    input: unknown
    actor: Actor
    idempotencyKey: string
  }) => Promise<ExecuteResult>
) {
  return withTaskFence(lease, async (task) => {
    if (
      options.actor.type !== "coach" ||
      options.actor.userId !== task.ownerId ||
      options.actor.chatId !== task.chatId
    )
      throw new Error("Task actor mismatch")
    if (!options.idempotencyKey.startsWith(`coach:${task.id}:`))
      throw new CommandError(ERROR_CODES.CONFLICT, "Task key mismatch")
    if (
      !command ||
      command.transaction === "none" ||
      command.idempotency !== "keyed"
    )
      throw new Error("Task command must be transactional and keyed")
    const result = await execute(options)
    if (result.pendingActionId)
      await getDb()
        .update(pendingActions)
        .set({ coachTaskId: task.id, coachIntentKey: options.idempotencyKey })
        .where(eq(pendingActions.id, result.pendingActionId))
    if (!result.pending) {
      const receipts = [
        ...(await getDb()
          .select({ command: activity.command, inputHash: activity.inputHash })
          .from(activity)
          .where(
            and(
              eq(activity.userId, task.ownerId),
              eq(activity.idempotencyKey, options.idempotencyKey)
            )
          )),
        ...(await getDb()
          .select({
            command: idempotency.command,
            inputHash: idempotency.inputHash,
          })
          .from(idempotency)
          .where(
            and(
              eq(idempotency.userId, task.ownerId),
              eq(idempotency.key, options.idempotencyKey)
            )
          )),
      ]
      if (
        receipts.length !== 1 ||
        receipts.some(
          (receipt) =>
            receipt.command !== options.name ||
            receipt.inputHash !== inputHash(options.input)
        )
      )
        throw new CommandError(
          ERROR_CODES.CONFLICT,
          "Task receipt does not match its intent"
        )
    }
    return result
  })
}
