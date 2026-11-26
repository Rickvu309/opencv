import { personActor } from "@workspace/domain/kernel"
import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { jobs, user } from "../db/schema.js"
import { installRegistry } from "../install.js"
import { createMigratedTestDb } from "../test/harness.js"

describe("inbox commands", () => {
  it("links the newer Local startup job when shared words tie", async () => {
    const { db, client } = await createMigratedTestDb()
    const registry = installRegistry()
    const userId = "user-inbox-match"
    await db.insert(user).values({
      id: userId,
      name: "Ada",
      email: "ada-inbox-match@example.com",
    })
    await withDatabase(db, async () => {
      const actor = personActor(userId)
      const older = await registry.execute({
        name: "job.create",
        input: {
          title: "Associate writer",
          company: "Local startup",
          stage: "applied",
        },
        actor,
      })
      const newer = await registry.execute({
        name: "job.create",
        input: {
          title: "Associate lead",
          company: "Local startup",
          stage: "applied",
        },
        actor,
      })
      const olderId = (older.output as { id: string }).id
      const newerId = (newer.output as { id: string }).id
      await db
        .update(jobs)
        .set({ updatedAt: new Date("2026-10-01T00:00:00.000Z") })
        .where(eq(jobs.id, olderId))
      await db
        .update(jobs)
        .set({ updatedAt: new Date("2026-10-20T00:00:00.000Z") })
        .where(eq(jobs.id, newerId))
      const scanned = await registry.execute({
        name: "inbox.scan",
        input: {},
        actor,
      })
      const row = (
        scanned.output as {
          threads: {
            role: string
            jobId: string | null
            suggestedStage: string | null
          }[]
        }
      ).threads.find((thread) => thread.role === "Associate PM")
      expect(row?.jobId).toBe(newerId)
      expect(row?.suggestedStage).toBe("interview")
      await db
        .update(jobs)
        .set({ updatedAt: new Date("2026-10-20T00:00:00.000Z") })
        .where(eq(jobs.id, olderId))
      const again = await registry.execute({
        name: "inbox.scan",
        input: {},
        actor,
      })
      const tied = (
        again.output as {
          threads: {
            role: string
            jobId: string | null
            suggestedStage: string | null
          }[]
        }
      ).threads.find((thread) => thread.role === "Associate PM")
      expect(tied?.jobId).toBeNull()
      expect(tied?.suggestedStage).toBeNull()
    })
    await client.close()
  })
})
