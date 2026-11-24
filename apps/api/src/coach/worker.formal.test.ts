import { personActor } from "@workspace/domain"
import { and, eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { z } from "zod"
import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  activity,
  coachTasks,
  jobs,
  idempotency,
  pendingActions,
  taskEvents,
} from "../db/schema.js"
import { installRegistry } from "../install.js"
import { openBackend, REAL } from "../test/registry-formal-support.js"
import { seedTask } from "../test/coach-task-support.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import { inputHash, requestCancel } from "./task-store.js"
import type { WorkerRuntime } from "./model-step.js"
import { runCoachWorker } from "./worker.js"

function barrier() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
const settings = {
  workerId: "worker",
  catalogDigest: "test",
  runtimeVersion: 1,
  env: { COACH_TASK_WORKER: "internal" },
}
const final = { text: "Done.", intents: [], inputTokens: 1, outputTokens: 1 }

async function fixture(
  run: (
    seed: Awaited<ReturnType<typeof seedTask>>,
    registry: ReturnType<typeof installRegistry>
  ) => Promise<void>
) {
  const backend = await openBackend()
  try {
    await withDatabase(backend.db, async () => {
      const seed = await seedTask(inputHash)
      await getDb()
        .update(coachTasks)
        .set({ contextSnapshot: { messages: [] } })
        .where(eq(coachTasks.id, seed.taskId))
      await run(seed, installRegistry())
    })
  } finally {
    await backend.close()
  }
}

async function propose(
  seed: Awaited<ReturnType<typeof seedTask>>,
  registry: ReturnType<typeof installRegistry>
) {
  const created = await registry.execute({
    name: "job.create",
    input: { title: "Role", company: "Acme" },
    actor: personActor(seed.ownerId),
  })
  const jobId = z.object({ id: z.string() }).parse(created.output).id
  const script = [
    {
      ...final,
      intents: [
        { id: "delete", name: "job.delete" as const, input: { jobId } },
      ],
    },
    final,
  ]
  const runtime = () => createScriptedWorkerRuntime(script)
  await runCoachWorker({ ...settings, registry, runtime })
  const [proposal] = await getDb().select().from(pendingActions)
  return { proposal: proposal!, runtime }
}

async function expectDeletionCommitted(
  proposal: typeof pendingActions.$inferSelect
) {
  const receipts = (await getDb().select().from(idempotency)).filter(
    (row) => row.command === "job.delete"
  )
  expect(receipts).toHaveLength(1)
  expect(receipts[0]).toMatchObject({
    userId: proposal.userId,
    key: proposal.coachIntentKey,
    inputHash: inputHash(proposal.input),
    result: { id: z.object({ jobId: z.string() }).parse(proposal.input).jobId },
  })
  const events = await getDb()
    .select()
    .from(taskEvents)
    .where(
      and(
        eq(taskEvents.taskId, proposal.coachTaskId!),
        eq(taskEvents.kind, "actionResolved")
      )
    )
  expect(events).toHaveLength(1)
  expect(events[0]?.logicalKey).toBe(`${proposal.coachIntentKey}:resolved`)
  expect(await getDb().select().from(jobs)).toHaveLength(0)
}

it.skipIf(!REAL).each(["cancel", "approve"] as const)(
  "serializes %s first against the other transaction using the task row",
  (first) =>
    fixture(async (seed, registry) => {
      const { proposal, runtime } = await propose(seed, registry)
      const locked = barrier(),
        release = barrier()
      const winner = transaction(async () => {
        await getDb()
          .select()
          .from(coachTasks)
          .where(eq(coachTasks.id, seed.taskId))
          .for("update")
        locked.release()
        await release.promise
        return first === "cancel"
          ? requestCancel(seed.taskId, seed.ownerId)
          : registry.approve(seed.ownerId, proposal.id)
      })
      await locked.promise
      const loser =
        first === "cancel"
          ? registry.approve(seed.ownerId, proposal.id)
          : requestCancel(seed.taskId, seed.ownerId)
      const settled = Promise.allSettled([winner, loser])
      release.release()
      const outcomes = await settled
      expect(outcomes[0]?.status).toBe("fulfilled")
      expect(outcomes[1]?.status).toBe(
        first === "cancel" ? "rejected" : "fulfilled"
      )
      await runCoachWorker({ ...settings, registry, runtime })
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "cancelled"
      )
      expect(await getDb().select().from(jobs)).toHaveLength(
        first === "cancel" ? 1 : 0
      )
      const receipts = await getDb().select().from(idempotency)
      expect(
        receipts.filter((row) => row.command === "job.delete")
      ).toHaveLength(first === "cancel" ? 0 : 1)
      if (first === "approve") await expectDeletionCommitted(proposal)
    })
)

it.skipIf(!REAL)(
  "two approval connections commit once and recovery needs no in-memory requeue",
  () =>
    fixture(async (seed, registry) => {
      const { proposal, runtime } = await propose(seed, registry)
      const receipts = await Promise.all([
        registry.approve(seed.ownerId, proposal.id),
        registry.approve(seed.ownerId, proposal.id),
      ])
      expect(receipts).toEqual([null, null])
      await expectDeletionCommitted(proposal)
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe("queued")
      await runCoachWorker({
        ...settings,
        registry: installRegistry(),
        runtime,
      })
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "succeeded"
      )
      await expectDeletionCommitted(proposal)
    })
)

it.skipIf(!REAL)(
  "maintenance recovers an approval committed by an older writer before requeue",
  () =>
    fixture(async (seed, registry) => {
      const { proposal, runtime } = await propose(seed, registry)
      await registry.approve(seed.ownerId, proposal.id)
      await getDb()
        .update(coachTasks)
        .set({ state: "waitingApproval" })
        .where(eq(coachTasks.id, seed.taskId))
      await runCoachWorker({
        ...settings,
        registry: installRegistry(),
        runtime,
      })
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "succeeded"
      )
      await expectDeletionCommitted(proposal)
    })
)

it.skipIf(!REAL)(
  "cancellation interrupts provider streaming on durable renewal",
  () =>
    fixture(async (seed, registry) => {
      const entered = barrier()
      let renew!: () => Promise<void>
      const runtime: WorkerRuntime = async function* (input) {
        yield { type: "text-delta", text: "draft" }
        entered.release()
        await new Promise<void>((resolve) =>
          input.signal.addEventListener("abort", () => resolve(), {
            once: true,
          })
        )
        input.signal.throwIfAborted()
      }
      const work = runCoachWorker({
        ...settings,
        registry,
        runtime: () => runtime,
        scheduleRenewal: (tick) => {
          renew = tick
          return () => {}
        },
      })
      await entered.promise
      await requestCancel(seed.taskId, seed.ownerId)
      await renew()
      await work
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "cancelled"
      )
      expect(await getDb().select().from(activity)).toHaveLength(0)
    })
)

it.skipIf(!REAL)(
  "a stale provider callback after takeover cannot persist a decision or effect",
  () =>
    fixture(async (seed, registry) => {
      const entered = barrier(),
        release = barrier()
      const stale: WorkerRuntime = async function* (input) {
        entered.release()
        await release.promise
        await input.boundary.persistStep({
          index: 0,
          stopReason: "tool_use",
          intents: [
            { id: "stale", name: "job.create", input: seed.intent.input },
          ],
          usage: { inputTokens: 1, outputTokens: 1 },
          message: {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "stale",
                name: "job_create",
                input: seed.intent.input,
              },
            ],
          },
        })
        yield { type: "text-delta", text: "stale" }
      }
      const work = runCoachWorker({
        ...settings,
        workerId: "old",
        registry,
        runtime: () => stale,
        scheduleRenewal: () => () => {},
      })
      await entered.promise
      await getDb()
        .update(coachTasks)
        .set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` })
        .where(eq(coachTasks.id, seed.taskId))
      await runCoachWorker({
        ...settings,
        workerId: "new",
        registry,
        runtime: () => createScriptedWorkerRuntime([final]),
      })
      release.release()
      await work
      expect((await getDb().select().from(coachTasks))[0]).toMatchObject({
        state: "succeeded",
        leaseOwner: "new",
        leaseEpoch: 2,
      })
      expect(await getDb().select().from(jobs)).toHaveLength(0)
      expect(
        (await getDb().select().from(taskEvents)).filter(
          (row) => row.kind === "action"
        )
      ).toHaveLength(0)
    })
)
