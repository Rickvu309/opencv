import { randomUUID } from "node:crypto"
import { coachActor } from "@workspace/domain/kernel"
import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"
import { runIntent } from "./task-effects.js"
import { getDb, transaction } from "../db/context.js"
import {
  coachTasks,
  coachUsage,
  pendingActions,
  taskEvents,
  toolIntents,
} from "../db/schema.js"
import { seedTask } from "../test/coach-task-support.js"
import {
  fixture,
  operation,
  receiptCount,
  run,
  words,
} from "../test/frozen-review-support.js"
import { registerBackendHooks } from "../test/registry-formal-support.js"
import { inputHash } from "../registry/receipt.js"

registerBackendHooks()

async function intentsOf(taskId: string) {
  return getDb()
    .select()
    .from(toolIntents)
    .where(eq(toolIntents.taskId, taskId))
}

async function eventsOf(taskId: string) {
  return getDb().select().from(taskEvents).where(eq(taskEvents.taskId, taskId))
}

async function proposalsOf(ownerId: string) {
  return getDb()
    .select()
    .from(pendingActions)
    .where(eq(pendingActions.userId, ownerId))
}

async function reviewedTask() {
  const task = await seedTask(inputHash)
  const intent = {
    ...task.intent,
    input: { ...words },
    inputHash: inputHash(words),
    operation: operation.name,
  }
  await getDb()
    .insert(toolIntents)
    .values({
      ...intent,
      taskId: task.taskId,
      state: "planned",
    })
  await getDb()
    .update(coachTasks)
    .set({
      state: "running",
      leaseOwner: "worker",
      leaseEpoch: 1,
      leaseUntil: sql`clock_timestamp() + interval '1 hour'`,
    })
    .where(eq(coachTasks.id, task.taskId))
  return {
    ...task,
    intent,
    lease: { taskId: task.taskId, workerId: "worker", epoch: 1 },
  }
}

it("the actual worker prepares before SQL and atomically records its proposal, intent and event", () =>
  run(async () => {
    const task = await reviewedTask(),
      { registry, calls } = fixture()
    const proposed = z
      .object({ pendingActionId: z.string() })
      .parse(await runIntent(task.lease, task.intent, registry))
    expect(await runIntent(task.lease, task.intent, registry)).toMatchObject(
      proposed
    )
    expect(calls.prepare).toBe(1)
    expect((await intentsOf(task.taskId))[0]?.state).toBe("proposed")
    expect(await eventsOf(task.taskId)).toHaveLength(1)
    await getDb()
      .update(coachTasks)
      .set({ state: "waitingApproval" })
      .where(eq(coachTasks.id, task.taskId))
    await registry.approve(task.ownerId, proposed.pendingActionId)
    expect(calls.prepare).toBe(1)
    expect(calls.commit).toBe(1)
    expect(await receiptCount(task.ownerId)).toBe(1)
    expect((await intentsOf(task.taskId))[0]?.state).toBe("committed")
  }))

for (const changed of ["cancel", "intent", "usage", "deadline"] as const) {
  it(`the actual worker refuses publication after ${changed} changes during preparation`, () =>
    run(async () => {
      const task = await reviewedTask()
      const { registry, calls } = fixture({
        prepare: async () => {
          if (changed === "intent")
            await getDb()
              .update(toolIntents)
              .set({ operationVersion: 2 })
              .where(eq(toolIntents.taskId, task.taskId))
          else if (changed === "usage")
            await getDb()
              .update(coachUsage)
              .set({ id: randomUUID() })
              .where(eq(coachUsage.coachTaskId, task.taskId))
          else
            await getDb()
              .update(coachTasks)
              .set(
                changed === "cancel"
                  ? { cancelRequestedAt: sql`clock_timestamp()` }
                  : { deadlineAt: sql`clock_timestamp() - interval '1 second'` }
              )
              .where(eq(coachTasks.id, task.taskId))
        },
      })
      await expect(
        runIntent(task.lease, task.intent, registry)
      ).rejects.toThrow()
      expect(calls.prepare).toBe(1)
      expect(calls.commit).toBe(0)
      expect(await receiptCount(task.ownerId)).toBe(0)
      expect(await proposalsOf(task.ownerId)).toHaveLength(0)
      expect(await eventsOf(task.taskId)).toHaveLength(0)
      expect((await intentsOf(task.taskId))[0]?.state).toBe("planned")
    }))
}

it("the actual worker rolls back its proposal and reservation when the final lease check fails", () =>
  run(async () => {
    const task = await reviewedTask()
    const { registry, calls } = fixture({
      revalidate: async () => {
        await getDb()
          .update(coachTasks)
          .set({
            leaseUntil: sql`clock_timestamp() - interval '1 second'`,
          })
          .where(eq(coachTasks.id, task.taskId))
      },
    })
    await expect(runIntent(task.lease, task.intent, registry)).rejects.toThrow(
      "Task lease lost"
    )
    expect(calls.prepare).toBe(1)
    expect(await receiptCount(task.ownerId)).toBe(0)
    expect(await proposalsOf(task.ownerId)).toHaveLength(0)
    expect(await eventsOf(task.taskId)).toHaveLength(0)
    expect((await intentsOf(task.taskId))[0]?.state).toBe("planned")
    const retried = fixture()
    expect(
      await runIntent(task.lease, task.intent, retried.registry)
    ).toMatchObject({ pending: true })
    expect(retried.calls.prepare).toBe(1)
  }))

it("a terminal intent published during preparation wins without another proposal or event", () =>
  run(async () => {
    const task = await reviewedTask()
    const winner = fixture()
    let completed: unknown
    const { registry, calls } = fixture({
      prepare: async () => {
        completed = await runIntent(task.lease, task.intent, winner.registry)
      },
    })
    expect(await runIntent(task.lease, task.intent, registry)).toEqual(
      completed
    )
    expect(calls.prepare).toBe(1)
    expect(winner.calls.prepare).toBe(1)
    expect(await proposalsOf(task.ownerId)).toHaveLength(1)
    expect(await eventsOf(task.taskId)).toHaveLength(1)
    expect(await receiptCount(task.ownerId)).toBe(1)
  }))

it.each(["denied", "expired", "database-clock expiry"] as const)(
  "a prepared task requires ambient SQL, survives rollback and rechecks %s replay",
  (change) =>
    run(async () => {
      const task = await reviewedTask(),
        { registry, calls } = fixture()
      const [row] = await getDb()
        .select()
        .from(coachTasks)
        .where(eq(coachTasks.id, task.taskId))
      const [usage] = await getDb()
        .select()
        .from(coachUsage)
        .where(eq(coachUsage.coachTaskId, task.taskId))
      const options = {
        name: operation.name,
        input: { ...words },
        actor: coachActor(task.ownerId, row!.chatId, usage!.id),
        idempotencyKey: task.intent.intentKey,
      }
      const publish = await registry.prepareTask(task.lease, options)
      options.input.after = "Changed"
      await expect(publish()).rejects.toThrow("owning transaction")
      await expect(
        transaction(async () => {
          await publish()
          throw new Error("rollback")
        })
      ).rejects.toThrow("rollback")
      expect(await receiptCount(task.ownerId)).toBe(0)
      const proposed = await transaction(publish)
      expect(calls.prepare).toBe(1)
      expect(proposed.review).toEqual(words)
      const replay = await registry.prepareTask(task.lease, {
        ...options,
        input: words,
      })
      await getDb()
        .update(pendingActions)
        .set(
          change === "database-clock expiry"
            ? { createdAt: sql`clock_timestamp() - interval '25 hours'` }
            : { status: change }
        )
        .where(eq(pendingActions.id, proposed.pendingActionId!))
      await expect(transaction(replay)).rejects.toMatchObject({
        code: "CONFLICT",
      })
      expect(calls.prepare).toBe(1)
    })
)
