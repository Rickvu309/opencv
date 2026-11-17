import { withDatabase, type TestDatabase } from "../db/context.js"
import { installRegistry } from "../registry/install.js"
import { seedTask } from "../test/coach-task-support.js"
import { createMigratedTestDb } from "../test/harness.js"
import { inputHash } from "./task-store.js"

export async function richTaskFixture(
  run: (
    seed: Awaited<ReturnType<typeof seedTask>> & { db: TestDatabase },
    registry: ReturnType<typeof installRegistry>
  ) => Promise<void>
) {
  const { db, client } = await createMigratedTestDb()
  try {
    await withDatabase(db, async () => {
      const seed = await seedTask(inputHash)
      await run({ ...seed, db }, installRegistry())
    })
  } finally {
    await client.close()
  }
}
