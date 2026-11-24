import { eq, sql } from "drizzle-orm"
import { expect, it, vi } from "vitest"
import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  activity,
  coachTasks,
  jobs,
  taskEvents,
  toolIntents,
} from "../db/schema.js"
import { openBackend, REAL } from "../test/registry-formal-support.js"
import {
  claim,
  inputHash,
  persistStep,
  runIntent,
  renew,
} from "./task-store.js"
import { installRegistry } from "../install.js"
import { seedTask } from "../test/coach-task-support.js"

it.skipIf(!REAL)(
  "two connections skip locked claims and reject a paused stale writer after takeover",
  async () => {
    const backend = await openBackend()
    try {
      await withDatabase(backend.db, async () => {
        const { taskId, intent } = await seedTask(inputHash)
        let release!: () => void, entered!: () => void
        const held = new Promise<void>((r) => {
          release = r
        })
        const locked = new Promise<void>((r) => {
          entered = r
        })
        const claimant = transaction(async () => {
          const a = (await claim({ workerId: "A", leaseMs: 60000 }))!
          entered()
          await held
          return a
        })
        await locked
        let a
        try {
          expect(await claim({ workerId: "B", leaseMs: 60000 })).toBeNull()
        } finally {
          release()
          a = await claimant
        }
        await persistStep(
          a.lease,
          {
            completedStep: 0,
            phase: "decision",
            modelMessages: [],
            observedRevisions: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            requestManifest: {},
          },
          [intent]
        )
        let resume!: () => void, paused!: () => void
        const barrier = new Promise<void>((r) => {
          resume = r
        })
        const ready = new Promise<void>((r) => {
          paused = r
        })
        const stale = (async () => {
          paused()
          await barrier
          return runIntent(a.lease, intent, installRegistry())
        })()
        await ready
        await getDb()
          .update(coachTasks)
          .set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` })
          .where(eq(coachTasks.id, taskId))
        const b = (await claim({ workerId: "B", leaseMs: 60000 }))!
        expect(b.lease.epoch).toBe(a.lease.epoch + 1)
        const rejected = expect(stale).rejects.toThrow("lease lost")
        resume()
        await rejected
        expect(await getDb().select().from(taskEvents)).toHaveLength(0)
        expect(await getDb().select().from(jobs)).toHaveLength(0)
        expect(await getDb().select().from(activity)).toHaveLength(0)
        expect((await getDb().select().from(toolIntents))[0]?.state).toBe(
          "planned"
        )
      })
    } finally {
      await backend.close()
    }
  }
)

it.skipIf(!REAL)(
  "an ambient transaction cannot defer the task fence commit past its lease",
  async () => {
    const backend = await openBackend()
    try {
      await withDatabase(backend.db, async () => {
        const { intent } = await seedTask(inputHash)
        const { lease } = (await claim({
          workerId: "ambient",
          leaseMs: 60000,
        }))!
        await persistStep(
          lease,
          {
            completedStep: 0,
            phase: "decision",
            modelMessages: [],
            observedRevisions: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            requestManifest: {},
          },
          [intent]
        )
        await renew(lease, 500)
        await expect(
          transaction(async () => {
            await runIntent(lease, intent, installRegistry())
            await getDb().execute(sql`select pg_sleep(0.7)`)
          })
        ).rejects.toMatchObject({ code: "AMBIENT_TASK_TRANSACTION" })
        expect(await getDb().select().from(jobs)).toHaveLength(0)
        expect(await getDb().select().from(activity)).toHaveLength(0)
        expect(await getDb().select().from(taskEvents)).toHaveLength(0)
        expect((await getDb().select().from(toolIntents))[0]?.state).toBe(
          "planned"
        )
      })
    } finally {
      await backend.close()
    }
  }
)

it.skipIf(!REAL)(
  "the task lock excludes takeover during effects and expiry rolls back before commit",
  async () => {
    const backend = await openBackend()
    try {
      await withDatabase(backend.db, async () => {
        const { intent } = await seedTask(inputHash)
        const { lease } = (await claim({ workerId: "locked", leaseMs: 60000 }))!
        await persistStep(
          lease,
          {
            completedStep: 0,
            phase: "decision",
            modelMessages: [],
            observedRevisions: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            requestManifest: {},
          },
          [intent]
        )
        const registry = installRegistry()
        const execute = registry.executeTask.bind(registry)
        let entered!: () => void, release!: () => void
        const ready = new Promise<void>((resolve) => {
          entered = resolve
        })
        const barrier = new Promise<void>((resolve) => {
          release = resolve
        })
        vi.spyOn(registry, "executeTask").mockImplementation(
          async (...args) => {
            const result = await execute(...args)
            entered()
            await barrier
            return result
          }
        )
        await renew(lease, 500)
        const execution = runIntent(lease, intent, registry)
        const rejected = expect(execution).rejects.toThrow("lease lost")
        await ready
        try {
          await getDb().execute(sql`select pg_sleep(0.7)`)
          expect(
            await claim({ workerId: "takeover", leaseMs: 60000 })
          ).toBeNull()
        } finally {
          release()
        }
        await rejected
        expect(await getDb().select().from(jobs)).toHaveLength(0)
        expect(await getDb().select().from(activity)).toHaveLength(0)
        expect(await getDb().select().from(taskEvents)).toHaveLength(0)
        expect((await getDb().select().from(toolIntents))[0]?.state).toBe(
          "planned"
        )
        expect(
          (await claim({ workerId: "takeover", leaseMs: 60000 }))?.lease.epoch
        ).toBe(lease.epoch + 1)
      })
    } finally {
      await backend.close()
    }
  }
)
