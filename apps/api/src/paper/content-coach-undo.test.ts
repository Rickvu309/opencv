import type { PaperDocument } from "@workspace/domain"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { withText } from "../test/paper-content.js"

const userId = "user-coach-undo"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const inDatabase = <T>(run: () => Promise<T>) => h.inDatabase(run)

describe("undo of a Coach edit", () => {
  it("keeps marks, links, titles and heading levels through an edit and its undo", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.map((block) => {
              if (block.id === "t1") {
                return {
                  id: "t1",
                  type: "heading",
                  level: 3,
                  content: [
                    { text: "Lead ", bold: true },
                    { text: "site", href: "https://example.com" },
                  ],
                }
              }
              return block.type === "section"
                ? { ...block, title: "Profile" }
                : block
            }),
          }) as PaperDocument
      )
      const before = await h.paperOf(docId)
      const edited = await h.coach(docId, 2, [
        { op: "setText", blockId: "t2", text: "Second, *revised*." },
        h.experience,
      ])
      expect(await h.rowCount(docId)).toBe(2)
      const kept = await h.paperOf(docId)
      expect(kept.blocks[0]).toMatchObject({ title: "Profile" })
      expect(kept.blocks[1]).toMatchObject({
        type: "heading",
        level: 3,
        content: [{ bold: true }, { href: "https://example.com" }],
      })
      await h.store.registry.undo(userId, edited.activityId!)
      expect(await h.paperOf(docId)).toEqual(before)
    })
  })

  it("works after a reload and after several later rows, keeping later typing", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const edited = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph. Coach adds" },
        h.experience,
      ])
      await h.person(docId, client, (paper) =>
        withText(paper, "t2", "Second paragraph. One")
      )
      await h.person(docId, client, (paper) =>
        withText(paper, "t1", "First paragraph. Coach 1 adds")
      )
      await h.person(docId, client, (paper) =>
        withText(paper, "t2", "Second paragraph. One two")
      )
      await h.dropCache(docId)
      await h.store.registry.undo(userId, edited.activityId!)
      expect(await h.textOf(docId, "t1")).toBe("First paragraph.1 ")
      expect(await h.textOf(docId, "t2")).toBe("Second paragraph. One two")
      expect((await h.paperOf(docId)).blocks.map((b) => b.type)).toEqual([
        "section",
        "paragraph",
        "paragraph",
      ])
    })
  })

  it("brings back what the Coach removed", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const edited = await h.coach(docId, 1, [{ op: "remove", blockId: "t2" }])
      await h.person(docId, client, (paper) =>
        withText(paper, "t1", "First paragraph. Typed")
      )
      await h.store.registry.undo(userId, edited.activityId!)
      expect(await h.textOf(docId, "t2")).toBe("Second paragraph.")
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. Typed")
    })
  })

  it("refuses to undo an edit a newer edit changed the same block on, until that one is undone", async () => {
    await inDatabase(async () => {
      const { docId } = await h.created()
      const older = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph. A" },
      ])
      const overlapping = await h.coach(docId, 2, [
        { op: "setText", blockId: "t1", text: "First paragraph. A B" },
      ])
      const apart = await h.coach(docId, 3, [
        { op: "setText", blockId: "t2", text: "Second paragraph. C" },
      ])
      const blocked = await h.store.registry.undoBlockedReason(
        userId,
        "paper.revertEdit",
        { docId, editId: older.output.editId }
      )
      expect(blocked).toContain("newer Coach edit")
      await expect(
        h.store.registry.undo(userId, older.activityId!)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      await h.store.registry.undo(userId, apart.activityId!)
      await h.store.registry.undo(userId, overlapping.activityId!)
      await h.store.registry.undo(userId, older.activityId!)
      expect(await h.textOf(docId, "t1")).toBe("First paragraph.")
      expect(await h.textOf(docId, "t2")).toBe("Second paragraph.")
    })
  })

  it("lets an edit be undone when a newer one touched other blocks", async () => {
    await inDatabase(async () => {
      const { docId } = await h.created()
      const older = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph. A" },
      ])
      await h.coach(docId, 2, [
        { op: "setText", blockId: "t2", text: "Second paragraph. B" },
      ])
      await h.store.registry.undo(userId, older.activityId!)
      expect(await h.textOf(docId, "t1")).toBe("First paragraph.")
      expect(await h.textOf(docId, "t2")).toBe("Second paragraph. B")
    })
  })
})
