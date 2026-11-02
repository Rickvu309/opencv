import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { activity, paperDocUpdates } from "../db/schema.js"
import { createId } from "../id.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"

const userId = "user-activity-guard"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

type Entry = { command: string; reversible: boolean; subjectId: string }

const feed = async () =>
  (await h.store.registry.read("activity.list", {}, h.store.actor)) as Entry[]

describe("the activity feed and Coach edits", () => {
  it("still reads, with the row not reversible, once the paper is deleted", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph, more." },
      ])
      const before = (await feed()).find(
        (item) => item.subjectId === docId && item.command === "paper.edit"
      )
      expect(before?.reversible).toBe(true)
      await h.run("paper.delete", { docId })
      const after = (await feed()).filter(
        (item) => item.subjectId === docId && item.command === "paper.edit"
      )
      expect(after.length).toBeGreaterThan(0)
      expect(after.every((item) => !item.reversible)).toBe(true)
    })
  })

  it("reads 30 Coach edits of one paper from stored data in one pass", async () => {
    await h.inDatabase(async () => {
      const { docId } = await h.created()
      for (let n = 0; n < 30; n += 1) {
        const editId = createId()
        await h.store.db.insert(paperDocUpdates).values({
          paperId: docId,
          seq: 2 + n,
          origin: "coach",
          editId,
          basedOn: 1 + n,
          touched: [n % 2 === 0 ? "t1" : "t2"],
          update: Buffer.from([0, 0]),
        })
        await h.store.db.insert(activity).values({
          id: createId(),
          userId,
          actor: "coach",
          command: "paper.edit",
          subjectKind: "paper",
          subjectId: docId,
          summary: `Edited ${n}`,
          reversalCommand: "paper.revertEdit",
          reversalInput: { docId, editId },
        })
      }
      const started = performance.now()
      const rows = (await feed()).filter(
        (item) => item.subjectId === docId && item.command === "paper.edit"
      )
      const took = performance.now() - started
      console.log(`activity.list with 30 Coach edits: ${took.toFixed(1)} ms`)
      expect(rows).toHaveLength(30)
      expect(rows.filter((item) => item.reversible).length).toBeGreaterThan(0)
      expect(rows.filter((item) => !item.reversible).length).toBeGreaterThan(0)
      expect(took).toBeLessThan(500)
      await h.store.db.delete(activity).where(eq(activity.userId, userId))
    })
  })
})
