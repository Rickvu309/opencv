import { personActor } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { withDatabase } from "../db/context.js"
import { coachUsage, user } from "../db/schema.js"
import { createMigratedTestDb } from "../test/harness.js"
import { installRegistry } from "../install.js"

describe("job.preview with the Coach interpreter on", () => {
  it("keeps the parsed fields when the interpreter throws, and opens no coach_usage row", async () => {
    const { db, client } = await createMigratedTestDb()
    const interpret = vi.fn(async () => {
      throw new Error("interpreter unavailable")
    })
    const registry = installRegistry({ interpret })
    const userId = "user-job-preview"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-job-preview@example.com",
    })
    try {
      const preview = await withDatabase(db, () =>
        registry.read(
          "job.preview",
          { text: "Acme is hiring an Engineer in Oslo." },
          personActor(userId)
        )
      )
      expect(interpret).toHaveBeenCalledOnce()
      expect(preview).toMatchObject({
        status: "filled",
        fields: { company: "Acme", title: "Engineer", location: "Oslo" },
      })
      expect(await db.select().from(coachUsage)).toEqual([])
    } finally {
      installRegistry({ interpret: null })
      await client.close()
    }
  })
})
