import { personActor } from "@workspace/domain"
import { eq, sql } from "drizzle-orm"
import { expect, it, vi } from "vitest"
import { z } from "zod"
import { getDb, withDatabase } from "../db/context.js"
import {
  activity,
  chatMessages,
  coachTasks,
  coachUsage,
  jobs,
  pendingActions,
  taskCheckpoints,
  toolIntents,
} from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { createMigratedTestDb } from "../test/harness.js"
import { seedTask } from "../test/coach-task-support.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import { inputHash } from "./task-store.js"
import { runCoachWorker } from "./worker.js"
import * as workerStore from "./worker-store.js"

type ScriptIntent = Parameters<
  typeof createScriptedWorkerRuntime
>[0][number]["intents"][number]

const final = { text: "Saved.", intents: [], inputTokens: 2, outputTokens: 3 }
const settings = {
  env: { COACH_TASK_WORKER: "internal" },
  workerId: "worker",
  catalogDigest: "test",
  runtimeVersion: 1,
}

async function fixture(
  run: (
    seed: Awaited<ReturnType<typeof seedTask>>,
    registry: ReturnType<typeof installRegistry>
  ) => Promise<void>
) {
  const { db, client } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const seed = await seedTask(inputHash)
      await getDb()
        .update(coachTasks)
        .set({ contextSnapshot: { messages: [] } })
        .where(eq(coachTasks.id, seed.taskId))
      await run(seed, installRegistry())
    })
  } finally {
    await client.close()
  }
}

it.each([
  ["approve", "proposal-first"],
  ["deny", "proposal-first"],
  ["approve", "automatic-first"],
  ["deny", "automatic-first"],
] as const)(
  "completes %s before pause with %s intents without losing automatic work",
  (resolution, order) =>
    fixture(async ({ taskId, ownerId, intent }, registry) => {
      const created = await registry.execute({
        name: "job.create",
        input: { title: "Old role", company: "Acme" },
        actor: personActor(ownerId),
      })
      const jobId = z.object({ id: z.string() }).parse(created.output).id
      const proposal: ScriptIntent = {
        id: "delete",
        name: "job.delete",
        input: { jobId },
      }
      const automatic: ScriptIntent = {
        id: "create",
        name: "job.create",
        input: intent.input,
      }
      const script = [
        {
          ...final,
          intents:
            order === "proposal-first"
              ? [proposal, automatic]
              : [automatic, proposal],
        },
        final,
      ]
      const restoreTask = workerStore.restoreTask
      let interleaved = false
      const restore = vi
        .spyOn(workerStore, "restoreTask")
        .mockImplementation(async (id) => {
          const snapshot = await restoreTask(id)
          if (
            !interleaved &&
            snapshot.intents.some((row) => row.state === "proposed")
          ) {
            interleaved = true
            const [pending] = await getDb().select().from(pendingActions)
            if (resolution === "approve")
              await registry.approve(ownerId, pending!.id)
            else await registry.deny(ownerId, pending!.id)
          }
          return snapshot
        })
      try {
        await runCoachWorker({
          ...settings,
          registry,
          runtime: () => createScriptedWorkerRuntime(script),
        })
      } finally {
        restore.mockRestore()
      }
      expect(interleaved).toBe(true)
      expect((await getDb().select().from(coachTasks))[0]).toMatchObject({
        id: taskId,
        state: "succeeded",
        errorCode: null,
      })
      const intents = await getDb()
        .select()
        .from(toolIntents)
        .orderBy(toolIntents.slot)
      expect(intents.find((row) => row.operation === "job.create")?.state).toBe(
        "committed"
      )
      expect(intents.find((row) => row.operation === "job.delete")?.state).toBe(
        resolution === "approve" ? "committed" : "denied"
      )
      expect(await getDb().select().from(jobs)).toHaveLength(
        resolution === "approve" ? 1 : 2
      )
      expect(
        (await getDb().select().from(activity)).filter(
          (row) =>
            row.idempotencyKey ===
            `coach:${taskId}:0:${order === "proposal-first" ? 1 : 0}`
        )
      ).toHaveLength(1)
      expect(
        (await getDb().select().from(taskCheckpoints)).filter(
          (row) => row.phase === "results"
        )
      ).toHaveLength(2)
    })
)

it("expires a waiting task with closed approval parts and preserved committed receipts", () =>
  fixture(async ({ taskId, ownerId, intent }, registry) => {
    const created = await registry.execute({
      name: "job.create",
      input: { title: "Old role", company: "Acme" },
      actor: personActor(ownerId),
    })
    const jobId = z.object({ id: z.string() }).parse(created.output).id
    const runtime = () =>
      createScriptedWorkerRuntime([
        {
          ...final,
          intents: [
            { id: "create", name: "job.create", input: intent.input },
            { id: "delete", name: "job.delete", input: { jobId } },
          ],
        },
        final,
      ])
    await runCoachWorker({ ...settings, registry, runtime })
    expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
      "waitingApproval"
    )
    const [usage] = await getDb()
      .select()
      .from(coachUsage)
      .where(eq(coachUsage.coachTaskId, taskId))
    const [committed] = await getDb()
      .select()
      .from(activity)
      .where(eq(activity.turnId, usage!.id))
    await getDb()
      .update(coachTasks)
      .set({ deadlineAt: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(coachTasks.id, taskId))
    await runCoachWorker({ ...settings, registry, runtime })
    const [task] = await getDb().select().from(coachTasks)
    expect(task).toMatchObject({
      state: "failed",
      errorCode: "Task deadline exceeded",
    })
    const [proposal] = await getDb().select().from(pendingActions)
    expect(proposal?.status).toBe("denied")
    const [message] = await getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, task!.assistantMessageId!))
    const parts = z
      .array(
        z.object({
          type: z.string(),
          approval: z.string().optional(),
          activityId: z.string().optional(),
          name: z.string().optional(),
          ok: z.boolean().optional(),
        })
      )
      .parse(message?.parts)
    expect(parts.some((part) => part.approval === "pending")).toBe(false)
    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool",
          name: "job.delete",
          ok: false,
        }),
        expect.objectContaining({
          type: "tool",
          activityId: committed!.id,
          ok: true,
        }),
      ])
    )
    await expect(registry.approve(ownerId, proposal!.id)).rejects.toThrow()
  }))
