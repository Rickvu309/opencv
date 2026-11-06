import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  activity,
  coachTasks,
  jobs,
  taskEvents,
  toolIntents,
} from "../db/schema.js"
import { openBackend, REAL } from "../test/registry-formal-support.js"
import { claim, inputHash, persistStep, runIntent } from "./task-store.js"
import { installRegistry } from "../registry/install.js"
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
