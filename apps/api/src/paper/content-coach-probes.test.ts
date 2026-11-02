import type { CvPaper, PaperDocument } from "@workspace/domain"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { withText } from "../test/paper-content.js"

const userId = "user-coach-probes"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const inDatabase = <T>(run: () => Promise<T>) => h.inDatabase(run)

const experience = (id: string, bullet: string, text: string) => ({
  id,
  type: "experience",
  role: `Role ${id}`,
  company: `Co ${id}`,
  period: "2020",
  location: "",
  children: [{ id: bullet, type: "bullet", content: [{ text }], children: [] }],
})

async function withExperiences() {
  const { docId, client } = await h.created()
  await h.person(
    docId,
    client,
    (paper) =>
      ({
        ...paper,
        blocks: [
          ...paper.blocks,
          experience("e1", "b1", "Bullet one"),
          experience("e2", "b2", "Bullet two"),
        ],
      }) as PaperDocument
  )
  return { docId, client }
}

function movedFirst(paper: PaperDocument): PaperDocument {
  const blocks = [...paper.blocks]
  const [moved] = blocks.splice(
    blocks.findIndex((block) => block.id === "e1"),
    1
  )
  blocks.splice(1, 0, moved!)
  return { ...paper, blocks } as PaperDocument
}

const order = async (docId: string) =>
  (await h.paperOf(docId)).blocks.map((block) => block.id).join(",")

describe("edits in or after a block the person moved", () => {
  it("refuses setText, insertInto and insert on a child of a moved parent", async () => {
    await inDatabase(async () => {
      const { docId, client } = await withExperiences()
      await h.person(docId, client, movedFirst)
      const rows = await h.rowCount(docId)
      const result = await h.coach(docId, 2, [
        { op: "setText", blockId: "b1", text: "Bullet one COACHTEXT" },
        {
          op: "insertInto",
          into: "e1",
          blocks: [{ type: "bullet", text: "INTOTEXT" }],
        },
        {
          op: "insert",
          after: "b1",
          blocks: [{ type: "bullet", text: "AFTERTEXT" }],
        },
        { op: "remove", blockId: "b1" },
        { op: "move", blockId: "t2", after: "b1" },
      ])
      expect(result.output.outcomes.map((o) => o.status)).toEqual([
        "stale",
        "stale",
        "stale",
        "stale",
        "stale",
      ])
      expect(result.output.editId).toBeNull()
      expect(result.activityId).toBeNull()
      expect(await h.rowCount(docId)).toBe(rows)
    })
  })
})

describe("a Coach move beside a block the person is typing in", () => {
  it("keeps the typing in the neighbour", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(docId, client, (paper) =>
        withText(paper, "t2", "Second paragraph. TYPEDBYPERSON")
      )
      const result = await h.coach(docId, 1, [
        { op: "move", blockId: "t1", after: "t2" },
      ])
      expect(result.output.outcomes[0]).toMatchObject({ status: "applied" })
      expect(await order(docId)).toBe("s1,t2,t1")
      expect(await h.textOf(docId, "t2")).toBe(
        "Second paragraph. TYPEDBYPERSON"
      )
      expect(await h.textOf(docId, "t1")).toBe("First paragraph.")
    })
  })
})

describe("undo of structure", () => {
  it("moves a block back and keeps what the person typed in both blocks", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const moved = await h.coach(docId, 1, [
        { op: "move", blockId: "t1", after: "t2" },
      ])
      await h.person(docId, client, (paper) =>
        withText(
          withText(paper, "t1", "First paragraph. PERSONONE"),
          "t2",
          "Second paragraph. PERSONTWO"
        )
      )
      await h.store.registry.undo(userId, moved.activityId!)
      expect(await order(docId)).toBe("s1,t1,t2")
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. PERSONONE")
      expect(await h.textOf(docId, "t2")).toBe("Second paragraph. PERSONTWO")
    })
  })

  it("keeps a block the Coach added with only what the person typed in it", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const added = await h.coach(docId, 1, [
        {
          op: "insert",
          after: "t2",
          blocks: [{ type: "paragraph", text: "Coach para." }],
        },
      ])
      const id = (added.output.outcomes[0] as { createdIds?: string[] })
        .createdIds![0]!
      await h.person(docId, client, (paper) =>
        withText(paper, id, "Coach para. PERSONTYPED")
      )
      await h.store.registry.undo(userId, added.activityId!)
      expect(await h.textOf(docId, id)).toBe(" PERSONTYPED")
    })
  })

  it("removes a block the Coach added when nobody typed in it", async () => {
    await inDatabase(async () => {
      const { docId } = await h.created()
      const added = await h.coach(docId, 1, [
        {
          op: "insert",
          after: "t2",
          blocks: [{ type: "paragraph", text: "Coach para." }],
        },
      ])
      await h.store.registry.undo(userId, added.activityId!)
      expect(await order(docId)).toBe("s1,t1,t2")
    })
  })

  it("takes the Coach's words out of a block the person retyped", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const edited = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph. COACHWORDS" },
      ])
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.map((block) =>
              block.id === "t1" && "content" in block
                ? {
                    id: "t1",
                    type: "heading",
                    level: 2,
                    content: block.content,
                  }
                : block
            ),
          }) as PaperDocument
      )
      await h.store.registry.undo(userId, edited.activityId!)
      const block = (await h.paperOf(docId)).blocks.find((b) => b.id === "t1")
      expect(block).toMatchObject({
        type: "heading",
        content: [{ text: "First paragraph." }],
      })
    })
  })

  it("refuses an undo that would remove the person's work, and changes nothing", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const added = await h.coach(docId, 1, [
        {
          op: "insert",
          after: "t2",
          blocks: [
            {
              type: "experience",
              role: "Analyst",
              company: "Babbage",
              bullets: [{ text: "Led" }],
            },
          ],
        },
      ])
      const id = (added.output.outcomes[0] as { createdIds?: string[] })
        .createdIds![0]!
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.map((block) =>
              block.id === id && block.type === "experience"
                ? { ...block, company: "Other" }
                : block
            ),
          }) as PaperDocument
      )
      const rows = await h.rowCount(docId)
      await expect(
        h.store.registry.undo(userId, added.activityId!)
      ).rejects.toMatchObject({ code: "CONFLICT" })
      expect(await h.rowCount(docId)).toBe(rows)
      const view = (await h.paperOf(docId)) as CvPaper
      expect(view.blocks.some((block) => block.id === id)).toBe(true)
    })
  })
})

describe("two Coach edits from the same read", () => {
  it("refuses the second edit of a block the first one changed", async () => {
    await inDatabase(async () => {
      const { docId } = await h.created()
      await h.coach(docId, 1, [
        {
          op: "setText",
          blockId: "t1",
          text: "First paragraph, led a team of five.",
        },
      ])
      const second = await h.coach(docId, 1, [
        {
          op: "setText",
          blockId: "t1",
          text: "First paragraph, led a team of six engineers.",
        },
      ])
      expect(second.output.outcomes[0]).toMatchObject({ status: "stale" })
      expect(second.output.editId).toBeNull()
      expect(await h.textOf(docId, "t1")).toBe(
        "First paragraph, led a team of five."
      )
    })
  })
})
