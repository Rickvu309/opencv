import { readFileSync } from "node:fs"
import { personActor } from "@workspace/domain"
import { sql } from "drizzle-orm"
import { expect, it, vi } from "vitest"
import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  activity,
  coachTasks,
  jobs,
  idempotency,
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

it("intent execution refuses an ambient transaction before any effect", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { intent } = await seedTask(inputHash)
      const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
      await persistStep(lease, checkpoint, [intent])
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
    await client.close()
  }
})

it.each(["cancelled", "failed"] as const)(
  "%s finalization closes proposals and unexecuted intents atomically",
  async (state) => {
    const { client, db } = await createMigratedTestDb()
    try {
      await withDatabase(db, async () => {
        const { intent, ownerId, taskId } = await seedTask(inputHash)
        const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
        const registry = installRegistry()
        await persistStep(lease, checkpoint, [intent])
        await runIntent(lease, intent, registry)
        const [job] = await getDb().select().from(jobs)
        const input = { jobId: job!.id }
        const proposal = {
          ...intent,
          step: 1,
          intentKey: `coach:${taskId}:1:0`,
          operation: "job.delete",
          input,
          inputHash: inputHash(input),
        }
        const unexecuted = {
          ...intent,
          step: 1,
          slot: 1,
          providerToolUseId: "tool-1",
          intentKey: `coach:${taskId}:1:1`,
        }
        await persistStep(lease, { ...checkpoint, completedStep: 1 }, [
          proposal,
          unexecuted,
        ])
        await runIntent(lease, proposal, registry)
        if (state === "cancelled") await requestCancel(taskId, ownerId)
        await expect(
          transaction(async () => {
            await finalize(lease, state)
            throw new Error("rollback terminal cleanup")
          })
        ).rejects.toThrow("rollback terminal cleanup")
        expect(
          (
            await getDb()
              .select()
              .from(toolIntents)
              .orderBy(toolIntents.step, toolIntents.slot)
          ).map((row) => row.state)
        ).toEqual(["committed", "proposed", "planned"])
        expect((await getDb().select().from(pendingActions))[0]?.status).toBe(
          "pending"
        )
        await finalize(lease, state)
        await finalize(lease, state)
        const intents = await getDb()
          .select()
          .from(toolIntents)
          .orderBy(toolIntents.step, toolIntents.slot)
        expect(intents.map((row) => row.state)).toEqual([
          "committed",
          "cancelled",
          "cancelled",
        ])
        expect(intents.slice(1).every((row) => row.finishedAt !== null)).toBe(
          true
        )
        const [pending] = await getDb().select().from(pendingActions)
        expect(pending?.status).toBe("denied")
        await expect(
          registry.approve(ownerId, pending!.id)
        ).rejects.toMatchObject({ code: "CONFLICT" })
        expect(await getDb().select().from(jobs)).toHaveLength(1)
        expect((await getDb().select().from(coachTasks))[0]?.state).toBe(state)
        expect(
          (await getDb().select().from(taskEvents)).filter(
            (row) => row.logicalKey === "terminal"
          )
        ).toHaveLength(1)
      })
    } finally {
      await client.close()
    }
  }
)

it("ordinary registry execution cannot claim a task idempotency key", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { ownerId, intent } = await seedTask(inputHash)
      await expect(
        installRegistry().execute({
          name: "chat.create",
          input: { title: "Impostor" },
          actor: personActor(ownerId),
          idempotencyKey: intent.intentKey,
        })
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await getDb().select().from(activity)).toHaveLength(0)
    })
  } finally {
    await client.close()
  }
})

it("expiry during an owned effect rolls back the Job, receipt, intent and event", async () => {
  const { client, db } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { intent } = await seedTask(inputHash)
      const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
      await persistStep(lease, checkpoint, [intent])
      const registry = installRegistry()
      const execute = registry.executeTask.bind(registry)
      vi.spyOn(registry, "executeTask").mockImplementation(async (...args) => {
        const result = await execute(...args)
        await getDb().execute(sql`select pg_sleep(0.7)`)
        return result
      })
      await renew(lease, 500)
      await expect(runIntent(lease, intent, registry)).rejects.toThrow(
        "lease lost"
      )
      expect(await getDb().select().from(jobs)).toHaveLength(0)
      expect(await getDb().select().from(activity)).toHaveLength(0)
      expect(await getDb().select().from(taskEvents)).toHaveLength(0)
      expect((await getDb().select().from(toolIntents))[0]?.state).toBe(
        "planned"
      )
    })
  } finally {
    await client.close()
  }
})

it.each(["activity", "idempotency"] as const)(
  "%s replay must match both the intent command and input hash",
  async (table) => {
    const { client, db } = await createMigratedTestDb()
    try {
      await withDatabase(db, async () => {
        const { intent, ownerId } = await seedTask(inputHash)
        const { lease } = (await claim({ workerId: "A", leaseMs: 60000 }))!
        await persistStep(lease, checkpoint, [intent])
        for (const mismatch of ["command", "input", "missing"] as const) {
          const receipt = {
            command: mismatch === "command" ? "chat.create" : intent.operation,
            inputHash:
              mismatch === "missing"
                ? null
                : mismatch === "input"
                  ? inputHash({ title: "Other job" })
                  : intent.inputHash,
          }
          if (table === "activity")
            await getDb()
              .insert(activity)
              .values({
                ...receipt,
                id: crypto.randomUUID(),
                userId: ownerId,
                actor: "person",
                subjectKind: "job",
                subjectId: crypto.randomUUID(),
                summary: "Mismatched",
                idempotencyKey: intent.intentKey,
                result: { wrong: true },
              })
          else
            await getDb()
              .insert(idempotency)
              .values({
                ...receipt,
                userId: ownerId,
                key: intent.intentKey,
                result: { wrong: true },
              })
          await expect(
            runIntent(lease, intent, installRegistry())
          ).rejects.toMatchObject({ code: "CONFLICT" })
          expect((await getDb().select().from(toolIntents))[0]?.state).toBe(
            "planned"
          )
          expect(await getDb().select().from(taskEvents)).toHaveLength(0)
          expect(await getDb().select().from(jobs)).toHaveLength(0)
          if (table === "activity") await getDb().delete(activity)
          else await getDb().delete(idempotency)
        }
      })
    } finally {
      await client.close()
    }
  }
)

function detectTaskSafetyMistakes(sources: {
  effect: string
  fence: string
  store: string
  registry: string
}) {
  const mistakes: string[] = []
  if (
    !sources.effect.includes("return withOwnedTaskFence(") ||
    !/ownedTaskTransaction\(async \(\) => \{[\s\S]*?await lockTask\(lease\)\s+return result\s+\}\)/.test(
      sources.fence
    )
  )
    mistakes.push(
      "S1: intent execution must own the transaction and end with the locked lease check"
    )
  if (
    !/state: "cancelled"[\s\S]*?closeTaskApprovals\(task.id\)/.test(
      sources.store
    )
  )
    mistakes.push(
      "S2: terminal cleanup must cancel unresolved intents and close approvals"
    )
  if (
    !sources.registry.includes('startsWith("coach:")') ||
    !/receipt.command !== options.name[\s\S]*?receipt.inputHash !== inputHash\(options.input\)/.test(
      sources.fence
    )
  )
    mistakes.push(
      "S3: task keys must be reserved and receipts must bind command and input"
    )
  return mistakes
}

it("task safety guards reject each mistake fixture and accept the clean sources", () => {
  const clean = {
    effect: readFileSync(
      new URL("../coach/task-effects.ts", import.meta.url),
      "utf8"
    ),
    fence: readFileSync(
      new URL("../registry/task-fence.ts", import.meta.url),
      "utf8"
    ),
    store: readFileSync(
      new URL("../coach/task-store.ts", import.meta.url),
      "utf8"
    ),
    registry: readFileSync(
      new URL("../registry/registry.ts", import.meta.url),
      "utf8"
    ),
  }
  expect(detectTaskSafetyMistakes(clean)).toEqual([])
  expect(
    detectTaskSafetyMistakes({
      ...clean,
      effect: clean.effect.replace(
        "return withOwnedTaskFence(",
        "return withTaskFence("
      ),
    })
  ).toEqual([expect.stringContaining("S1:")])
  expect(
    detectTaskSafetyMistakes({
      ...clean,
      store: clean.store.replace(
        "closeTaskApprovals(task.id)",
        "unrelated(task.id)"
      ),
    })
  ).toEqual([expect.stringContaining("S2:")])
  expect(
    detectTaskSafetyMistakes({
      ...clean,
      fence: clean.fence.replace(
        "receipt.inputHash !== inputHash(options.input)",
        "false"
      ),
    })
  ).toEqual([expect.stringContaining("S3:")])
})
