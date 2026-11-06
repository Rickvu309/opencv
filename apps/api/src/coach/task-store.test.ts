import { and, eq, sql } from "drizzle-orm"
import { expect, it, vi } from "vitest"
import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  activity,
  coachTasks,
  jobs,
  pendingActions,
  taskEvents,
  toolIntents,
} from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"
import {
  claim,
  inputHash,
  persistStep,
  requestCancel,
  renew,
  finalize,
  append,
} from "./task-store.js"
import { runIntent } from "./task-effects.js"

import { seedTask } from "../test/coach-task-support.js"

const checkpoint = {
  completedStep: 0,
  phase: "decision",
  modelMessages: [{ role: "assistant", content: "decision" }],
  observedRevisions: [],
  usage: { inputTokens: 2, outputTokens: 3 },
  requestManifest: { model: "fake" },
} as const

it("recovers a committed intent without repeating its Job, receipt or ordered event", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { taskId, intent } = await seedTask(inputHash)
      const a = (await claim({ workerId: "A", leaseMs: 60000 }))!
      const registry = installRegistry()
      await expect(runIntent(a.lease, intent, registry)).rejects.toThrow(
        "Intent identity"
      )
      await persistStep(a.lease, checkpoint, [intent])
      await persistStep(a.lease, checkpoint, [intent])
      const first = await runIntent(a.lease, intent, registry)
      await getDb()
        .update(coachTasks)
        .set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` })
        .where(eq(coachTasks.id, taskId))
      const b = (await claim({ workerId: "B", leaseMs: 60000 }))!
      expect(b.lease.epoch).toBe(a.lease.epoch + 1)
      await expect(
        append(a.lease, { kind: "text", payload: "stale" })
      ).rejects.toThrow("lease lost")
      expect(await runIntent(b.lease, intent, registry)).toEqual(first)
      expect(await getDb().select().from(jobs)).toHaveLength(1)
      expect(
        await getDb()
          .select()
          .from(activity)
          .where(eq(activity.command, "job.create"))
      ).toHaveLength(1)
      expect(
        (await getDb().select().from(taskEvents)).map((e) => e.seq)
      ).toEqual([0])
      await expect(
        runIntent(b.lease, { ...intent, input: { title: "Other" } }, registry)
      ).rejects.toThrow("identity")
      await expect(
        runIntent(b.lease, { ...intent, intentKey: "wrong" }, registry)
      ).rejects.toThrow("identity")
      await finalize(b.lease, "succeeded")
      await finalize(b.lease, "succeeded")
      await expect(
        append(b.lease, { kind: "text", payload: "late" })
      ).rejects.toThrow("lease lost")
    })
  } finally {
    await client.close()
  }
})

it("ambient rollback cannot start a task effect", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { intent } = await seedTask(inputHash)
      const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
      await persistStep(lease, checkpoint, [intent])
      await expect(
        transaction(async () => {
          await runIntent(lease, intent, installRegistry())
          throw new Error("rollback")
        })
      ).rejects.toMatchObject({ code: "AMBIENT_TASK_TRANSACTION" })
      expect(await getDb().select().from(jobs)).toHaveLength(0)
      expect(await getDb().select().from(activity)).toHaveLength(0)
      expect(await getDb().select().from(taskEvents)).toHaveLength(0)
      expect((await getDb().select().from(toolIntents))[0]?.state).toBe(
        "planned"
      )
      await runIntent(lease, intent, installRegistry())
    })
  } finally {
    await client.close()
  }
})

it("cancel is monotonic and expired leases cannot renew or commit effects", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { taskId, ownerId, intent } = await seedTask(inputHash)
      const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
      await persistStep(lease, checkpoint, [intent])
      await requestCancel(taskId, ownerId)
      const [before] = await getDb()
        .select()
        .from(coachTasks)
        .where(eq(coachTasks.id, taskId))
      await requestCancel(taskId, ownerId)
      expect(
        (await getDb().select().from(coachTasks))[0]?.cancelRequestedAt
      ).toEqual(before?.cancelRequestedAt)
      await expect(runIntent(lease, intent, installRegistry())).rejects.toThrow(
        "lease lost"
      )
      expect(await renew(lease, 60000)).toBe("cancelling")
      await getDb()
        .update(coachTasks)
        .set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` })
        .where(eq(coachTasks.id, taskId))
      await expect(renew(lease, 60000)).rejects.toThrow("lease lost")
      const b = (await claim({ workerId: "B", leaseMs: 60000 }))!
      await finalize(b.lease, "cancelled")
      expect(await getDb().select().from(jobs)).toHaveLength(0)
    })
  } finally {
    await client.close()
  }
})

it("one slot produces one proposal and only public results are stored", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { intent, ownerId, taskId } = await seedTask(inputHash)
      const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
      await persistStep(lease, checkpoint, [intent])
      const registry = installRegistry()
      const result = await runIntent(lease, intent, registry)
      expect(JSON.stringify(result)).not.toContain("reversal")
      const [job] = await getDb().select().from(jobs)
      const input = { jobId: job!.id }
      const proposal = {
        ...intent,
        step: 1,
        intentKey: `coach:${lease.taskId}:1:0`,
        operation: "job.delete",
        input,
        inputHash: inputHash(input),
      }
      await persistStep(lease, { ...checkpoint, completedStep: 1 }, [proposal])
      const first = await runIntent(lease, proposal, registry)
      expect(first).toMatchObject({ pending: true })
      expect(await runIntent(lease, proposal, registry)).toEqual(first)
      const proposals = await getDb().select().from(pendingActions)
      expect(proposals).toHaveLength(1)
      await expect(registry.approve(ownerId, proposals[0]!.id)).rejects.toThrow(
        "durable worker"
      )
      expect(await getDb().select().from(jobs)).toHaveLength(1)
      await expect(finalize(lease, "succeeded")).rejects.toThrow("Unresolved")
      await expect(
        getDb()
          .update(toolIntents)
          .set({ state: "planned" })
          .where(eq(toolIntents.step, 1))
      ).rejects.toThrow()
      await getDb()
        .update(toolIntents)
        .set({ state: "denied", publicResult: { denied: true } })
        .where(eq(toolIntents.step, 1))
      await expect(
        getDb()
          .update(toolIntents)
          .set({ state: "committed" })
          .where(eq(toolIntents.step, 1))
      ).rejects.toThrow()
      expect(
        await getDb()
          .select()
          .from(toolIntents)
          .where(and(eq(toolIntents.step, 1), eq(toolIntents.slot, 0)))
      ).toHaveLength(1)
      await requestCancel(taskId, ownerId)
      await expect(registry.approve(ownerId, proposals[0]!.id)).rejects.toThrow(
        "durable worker"
      )
      expect(await getDb().select().from(jobs)).toHaveLength(1)
    })
  } finally {
    await client.close()
  }
})

it("an expired deadline permits terminal cleanup but never another effect", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { taskId, intent } = await seedTask(inputHash)
      const a = (await claim({ workerId: "A", leaseMs: 60000 }))!
      await persistStep(a.lease, checkpoint, [intent])
      await getDb()
        .update(coachTasks)
        .set({
          deadlineAt: sql`clock_timestamp() - interval '1 second'`,
          leaseUntil: sql`clock_timestamp() - interval '1 second'`,
        })
        .where(eq(coachTasks.id, taskId))
      const b = (await claim({ workerId: "B", leaseMs: 60000 }))!
      await expect(
        runIntent(b.lease, intent, installRegistry())
      ).rejects.toThrow("lease lost")
      await expect(renew(b.lease, 60000)).rejects.toThrow("lease lost")
      await finalize(b.lease, "failed")
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe("failed")
      expect(await getDb().select().from(jobs)).toHaveLength(0)
      expect(await getDb().select().from(taskEvents)).toHaveLength(1)
    })
  } finally {
    await client.close()
  }
})

it("cancellation before the first claim remains recoverable", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { taskId, ownerId } = await seedTask(inputHash)
      await requestCancel(taskId, ownerId)
      const claimed = await claim({ workerId: "cancel", leaseMs: 60000 })
      expect(claimed?.row.state).toBe("cancelling")
      await expect(
        getDb()
          .update(coachTasks)
          .set({ cancelRequestedAt: null })
          .where(eq(coachTasks.id, taskId))
      ).rejects.toThrow()
      await finalize(claimed!.lease, "cancelled")
      await expect(
        getDb()
          .update(coachTasks)
          .set({ state: "queued" })
          .where(eq(coachTasks.id, taskId))
      ).rejects.toThrow()
    })
  } finally {
    await client.close()
  }
})

it("expiry inside an owned effect rolls back its receipt and result", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { taskId, intent } = await seedTask(inputHash)
      const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
      await persistStep(lease, checkpoint, [intent])
      const registry = installRegistry()
      const execute = registry.execute.bind(registry)
      const spy = vi
        .spyOn(registry, "execute")
        .mockImplementation(async (options) => {
          const result = await execute(options)
          await getDb()
            .update(coachTasks)
            .set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` })
            .where(eq(coachTasks.id, taskId))
          return result
        })
      try {
        await expect(runIntent(lease, intent, registry)).rejects.toThrow(
          "lease lost"
        )
        expect(await getDb().select().from(jobs)).toHaveLength(0)
      } finally {
        spy.mockRestore()
      }
      expect(await getDb().select().from(activity)).toHaveLength(0)
      expect(await getDb().select().from(taskEvents)).toHaveLength(0)
      expect((await getDb().select().from(toolIntents))[0]?.state).toBe(
        "planned"
      )
      await expect(
        getDb()
          .update(toolIntents)
          .set({ input: { title: "mutant" } })
      ).rejects.toThrow()
    })
  } finally {
    await client.close()
  }
})

it("preserves checkpoint order, cumulative budgets and frozen query results", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { intent } = await seedTask(inputHash)
      const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
      await expect(
        persistStep(lease, { ...checkpoint, completedStep: 1 }, [intent])
      ).rejects.toThrow("order")
      await expect(
        persistStep(
          lease,
          { ...checkpoint, usage: { inputTokens: 1001, outputTokens: 0 } },
          [intent]
        )
      ).rejects.toThrow("budget")
      await persistStep(lease, checkpoint, [intent])
      const registry = installRegistry()
      await runIntent(lease, intent, registry)
      await expect(
        persistStep(
          lease,
          {
            ...checkpoint,
            phase: "results",
            usage: { inputTokens: 0, outputTokens: 0 },
          },
          []
        )
      ).rejects.toThrow("cumulative")
      await persistStep(lease, { ...checkpoint, phase: "results" }, [])
      const input = {}
      const query = {
        ...intent,
        step: 1,
        kind: "query" as const,
        operation: "job.list",
        intentKey: `coach:${lease.taskId}:1:0`,
        input,
        inputHash: inputHash(input),
      }
      await persistStep(lease, { ...checkpoint, completedStep: 1 }, [query])
      const first = await runIntent(lease, query, registry)
      await getDb().delete(jobs)
      expect(await runIntent(lease, query, registry)).toEqual(first)
      expect(
        (await getDb().select().from(taskEvents)).map((event) => event.seq)
      ).toEqual([0, 1])
      await persistStep(
        lease,
        { ...checkpoint, completedStep: 1, phase: "results" },
        []
      )
      const unsafe = {
        ...intent,
        step: 2,
        intentKey: `coach:${lease.taskId}:2:0`,
        operation: "paper.sync",
        input,
        inputHash: inputHash(input),
      }
      await persistStep(lease, { ...checkpoint, completedStep: 2 }, [unsafe])
      await expect(runIntent(lease, unsafe, registry)).rejects.toThrow(
        "transactional and keyed"
      )
      await finalize(lease, "failed")
    })
  } finally {
    await client.close()
  }
})

it("hashes JSON object keys consistently and preserves array order", () => {
  expect(inputHash({ z: [1, 2], a: { b: true, a: null } })).toBe(
    inputHash({ a: { a: null, b: true }, z: [1, 2] })
  )
  expect(inputHash([1, 2])).not.toBe(inputHash([2, 1]))
})
