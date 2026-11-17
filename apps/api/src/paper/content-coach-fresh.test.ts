import { paperNodeSpecs } from "@workspace/domain"
import type { CvPaper, PaperDocument } from "@workspace/domain"

import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { paperDocs } from "../db/schema.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { withText } from "../test/paper-content.js"

const userId = "user-coach-fresh"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const inDatabase = <T>(run: () => Promise<T>) => h.inDatabase(run)

describe("paper.edit freshness against a person who is typing", () => {
  it("refuses structure on what the person changed and keeps both texts", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const first = await h.coach(docId, 1, [h.experience])
      const added = (first.output.outcomes[0] as { createdIds?: string[] })
        .createdIds![0]!
      await h.person(docId, client, (paper) => {
        const cv = paper as CvPaper
        return withText(
          {
            ...cv,
            header: {
              ...(cv.header ?? paperNodeSpecs.header.blank()),
              city: "Paris",
            },
            blocks: cv.blocks.map((block) =>
              block.id === added && block.type === "experience"
                ? { ...block, role: "Director" }
                : block
            ),
          },
          "t1",
          "First paragraph. Typed by hand"
        )
      })
      const result = await h.coach(docId, first.output.revision, [
        { op: "setFields", blockId: added, fields: { role: "Lead" } },
        { op: "setFields", blockId: added, fields: { company: "Other" } },
        { op: "setHeader", fields: { city: "Rome" } },
        { op: "setHeader", fields: { phone: "123" } },
        { op: "setText", blockId: "t1", text: "First paragraph, reviewed." },
        { op: "remove", blockId: "t2" },
      ])
      expect(result.output.outcomes.map((o) => o.status)).toEqual([
        "stale",
        "applied",
        "stale",
        "applied",
        "applied",
        "applied",
      ])
      expect(result.output.outcomes[4]).toMatchObject({ merged: true })
      const paper = await h.paperOf(docId)
      expect(paper.header).toMatchObject({ city: "Paris", phone: "123" })
      const block = paper.blocks.find((b) => b.id === added)
      expect(block).toMatchObject({ role: "Director", company: "Other" })
      expect(paper.blocks.some((b) => b.id === "t2")).toBe(false)
      const merged = await h.textOf(docId, "t1")
      expect(merged).toContain("Typed by hand")
      expect(merged).toContain("reviewed")
    })
  })

  it("refuses a move and a remove of a block the person deleted or changed", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.filter((block) => block.id !== "t2"),
          }) as PaperDocument
      )
      await h.person(docId, client, (paper) =>
        withText(paper, "t1", "First paragraph. More")
      )
      const result = await h.coach(docId, 1, [
        { op: "remove", blockId: "t2" },
        { op: "setText", blockId: "t2", text: "x" },
        { op: "move", blockId: "t1", after: "t2" },
        { op: "remove", blockId: "t1" },
      ])
      expect(result.output.outcomes.map((o) => o.status)).toEqual([
        "stale",
        "stale",
        "stale",
        "stale",
      ])
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. More")
    })
  })

  it("writes no row and no activity when every op is stale", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.filter((block) => block.id !== "t2"),
          }) as PaperDocument
      )
      const rows = await h.rowCount(docId)
      const result = await h.coach(docId, 1, [{ op: "remove", blockId: "t2" }])
      expect(result.output.editId).toBeNull()
      expect(result.output.revision).toBe(2)
      expect(result.activityId).toBeNull()
      expect(result.reversal).toBeNull()
      expect(await h.rowCount(docId)).toBe(rows)
    })
  })

  it("refuses a basedOn above the revision or below the log", async () => {
    await inDatabase(async () => {
      const { docId } = await h.created()
      const edits = [{ op: "setText", blockId: "t1", text: "x" }]
      await expect(h.coach(docId, 9, edits)).rejects.toMatchObject({
        code: "CONFLICT",
      })
      await h.store.db
        .update(paperDocs)
        .set({ crdtBaseSeq: 1 })
        .where(eq(paperDocs.id, docId))
      await expect(h.coach(docId, 0, edits)).rejects.toMatchObject({
        code: "CONFLICT",
      })
      expect(await h.rowCount(docId)).toBe(0)
    })
  })
  it("replays a retried edit under the same key instead of applying it twice", async () => {
    await inDatabase(async () => {
      const { docId } = await h.created()
      const send = () =>
        h.store.registry.execute({
          name: "paper.edit",
          input: {
            docId,
            basedOn: 1,
            edits: [
              {
                op: "insert",
                after: "t2",
                blocks: [{ type: "paragraph", text: "Once" }],
              },
            ],
          },
          actor: h.store.actor,
          idempotencyKey: "coach-retry-1",
        })
      const first = await send()
      const second = await send()
      expect(second.output).toEqual(first.output)
      expect(second.activityId).toBe(first.activityId)
      expect(await h.rowCount(docId)).toBe(1)
      expect((await h.paperOf(docId)).blocks).toHaveLength(4)
    })
  })
})
