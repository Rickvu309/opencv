import { describe, expect, it } from "vitest"

import { user } from "../db/schema.js"
import { createMigratedTestDb } from "./harness.js"

describe("createMigratedTestDb", () => {
  it("clones a migrated database quickly", async () => {
    const timings: number[] = []
    for (let i = 0; i < 3; i += 1) {
      const started = performance.now()
      const { client } = await createMigratedTestDb()
      timings.push(performance.now() - started)
      await client.close()
    }
    const median = [...timings].sort((a, b) => a - b)[1]
    expect(median).toBeLessThan(1_500)
  }, 30_000)

  it("returns databases that do not share rows", async () => {
    const first = await createMigratedTestDb()
    const second = await createMigratedTestDb()
    try {
      await first.db.insert(user).values({
        id: "harness-isolation",
        name: "Isolated",
        email: "isolated@example.com",
      })
      expect(await first.db.select().from(user)).toHaveLength(1)
      expect(await second.db.select().from(user)).toHaveLength(0)
    } finally {
      await first.client.close()
      await second.client.close()
    }
  }, 30_000)
})
