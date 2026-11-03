import { randomUUID } from "node:crypto"

import { eq, sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { activity, user } from "../db/schema.js"
import {
  backend,
  registerBackendHooks,
} from "../test/registry-formal-support.js"
import { laterLiveAction } from "./expectation.js"

registerBackendHooks()

const SKIPPED = "This card moved again, so Undo was skipped"

async function moveAt(userId: string, createdAt: string) {
  const id = randomUUID()
  await backend.db.insert(activity).values({
    id,
    userId,
    actor: "person",
    command: "job.move",
    subjectKind: "job",
    subjectId: "job-1",
    summary: "Moved a card",
    reversalCommand: "job.move",
    reversalInput: {},
    reversalExpect: {
      query: "job.get",
      input: {},
      matches: { stage: "applied" },
      skipped: SKIPPED,
    },
  })
  await backend.db
    .update(activity)
    .set({ createdAt: sql`${createdAt}::timestamptz` })
    .where(eq(activity.id, id))
  const [row] = await backend.db
    .select()
    .from(activity)
    .where(eq(activity.id, id))
  return row!
}

describe("laterLiveAction orders by the stored microsecond timestamp", () => {
  it("a row read back as a millisecond Date does not count as later than itself", async () => {
    await withDatabase(backend.db, async () => {
      const userId = "later-live-self"
      await backend.db.insert(user).values({
        id: userId,
        name: "Ada",
        email: "later-live-self@example.com",
      })
      const first = await moveAt(userId, "2026-11-03T10:00:00.123456Z")
      expect(first.createdAt.toISOString()).toBe("2026-11-03T10:00:00.123Z")
      expect(await laterLiveAction(first)).toBeNull()
    })
  })

  it("a move later within the same millisecond still counts as later", async () => {
    await withDatabase(backend.db, async () => {
      const userId = "later-live-same-ms"
      await backend.db.insert(user).values({
        id: userId,
        name: "Ada",
        email: "later-live-same-ms@example.com",
      })
      const first = await moveAt(userId, "2026-11-03T10:00:00.123456Z")
      await moveAt(userId, "2026-11-03T10:00:00.123789Z")
      expect(await laterLiveAction(first)).toBe(SKIPPED)
    })
  })
})
