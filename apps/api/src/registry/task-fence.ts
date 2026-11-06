import { and, eq, sql } from "drizzle-orm"
import { getDb, savepoint, transaction } from "../db/context.js"
import { coachTasks } from "../db/schema.js"

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
