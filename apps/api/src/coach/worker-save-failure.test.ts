import { eq, sql } from "drizzle-orm"
import { expect, it } from "vitest"
import { getDb, withDatabase } from "../db/context.js"
import {
  activity,
  chatMessages,
  coachTasks,
  coachUsage,
  jobs,
} from "../db/schema.js"
import { installRegistry } from "../registry/install.js"
import { seedTask } from "../test/coach-task-support.js"
import { createMigratedTestDb } from "../test/harness.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import { inputHash } from "./task-store.js"
import { runCoachWorker } from "./worker.js"

it("keeps receipts and usage recoverable when saving the final reply fails", async () => {
  const { db, client } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const { taskId, intent } = await seedTask(inputHash)
      await getDb()
        .update(coachTasks)
        .set({ contextSnapshot: { messages: [] } })
        .where(eq(coachTasks.id, taskId))
      const registry = installRegistry()
      const runtime = () =>
        createScriptedWorkerRuntime([
          {
            text: "Saving.",
            intents: [
              {
                id: intent.providerToolUseId,
                name: "job.create",
                input: intent.input,
              },
            ],
            inputTokens: 2,
            outputTokens: 3,
          },
          { text: "Saved.", intents: [], inputTokens: 2, outputTokens: 3 },
        ])
      await getDb().execute(
        sql`create function reject_coach_reply() returns trigger language plpgsql as $$ begin raise exception 'synthetic-save-failure'; end $$`
      )
      await getDb().execute(
        sql`create trigger reject_coach_reply before insert on opencv_app.chat_messages for each row when (new.role = 'coach') execute function reject_coach_reply()`
      )
      const options = {
        registry,
        runtime,
        workerId: "save-test",
        catalogDigest: "test",
        runtimeVersion: 1,
        scheduleRenewal: () => () => {},
      }
      await expect(runCoachWorker(options)).rejects.toThrow()
      expect(await getDb().select().from(chatMessages)).toHaveLength(0)
      expect(await getDb().select().from(jobs)).toHaveLength(1)
      expect(await getDb().select().from(activity)).toHaveLength(1)
      expect(
        (await getDb().select().from(coachUsage))[0]?.finishReason
      ).toBeNull()
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "running"
      )
      await getDb().execute(
        sql`drop trigger reject_coach_reply on opencv_app.chat_messages`
      )
      await getDb().execute(sql`drop function reject_coach_reply()`)
      await getDb()
        .update(coachTasks)
        .set({ leaseUntil: sql`clock_timestamp() - interval '1 second'` })
        .where(eq(coachTasks.id, taskId))
      await runCoachWorker(options)
      expect((await getDb().select().from(coachTasks))[0]?.state).toBe(
        "succeeded"
      )
      const [message] = await getDb().select().from(chatMessages)
      expect(message?.status).toBe("final")
      expect(message?.parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "tool", name: "job.create" }),
        ])
      )
      expect((await getDb().select().from(coachUsage))[0]?.messageId).toBe(
        message?.id
      )
      expect(await getDb().select().from(jobs)).toHaveLength(1)
      expect(await getDb().select().from(activity)).toHaveLength(1)
    })
  } finally {
    await client.close()
  }
})
