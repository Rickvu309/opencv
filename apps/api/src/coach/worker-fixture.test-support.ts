import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb, withDatabase } from "../db/context.js"
import { coachTasks } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { createScriptedWorkerRuntime } from "./fake.js"
import { inputHash } from "./task-store.js"
import type { runCoachWorker } from "./worker.js"
import { createMigratedTestDb } from "../test/harness.js"
import { seedTask } from "../test/coach-task-support.js"

const scriptSchema = z.array(
  z.object({
    text: z.string(),
    intents: z.array(
      z.object({
        id: z.string(),
        name: z.literal("job.create"),
        input: z.unknown(),
      })
    ),
    inputTokens: z.number(),
    outputTokens: z.number(),
  })
)
export const final = {
  text: "Saved.",
  intents: [],
  inputTokens: 2,
  outputTokens: 3,
}
export const settings = {
  env: {},
  workerId: "worker",
  catalogDigest: "test",
  runtimeVersion: 1,
}

export async function fixture(
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
        .set({ contextSnapshot: { messages: [], script: [final] } })
        .where(eq(coachTasks.id, seed.taskId))
      await run(seed, installRegistry())
    })
  } finally {
    await client.close()
  }
}

export const storedRuntime: Parameters<typeof runCoachWorker>[0]["runtime"] = (
  task
) => {
  const context = z.object({ script: scriptSchema }).parse(task.contextSnapshot)
  return createScriptedWorkerRuntime(context.script)
}
