import type { PaperDocument } from "@workspace/domain"
import { stateVectorOf } from "@workspace/paper-crdt"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { encoded, typed, withText } from "../test/paper-content.js"

const userId = "user-coach-round2"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const inDatabase = <T>(run: () => Promise<T>) => h.inDatabase(run)

const order = async (docId: string) =>
  (await h.paperOf(docId)).blocks.map((block) => block.id).join(",")

const contentOf = async (docId: string, blockId: string) =>
  (await h.paperOf(docId)).blocks.find((block) => block.id === blockId) as {
    content: unknown
  }

function syncFrom(
  docId: string,
  client: Parameters<typeof typed>[0],
  change: (paper: PaperDocument) => PaperDocument
) {
  return h.run("paper.sync", {
    docId,
    epoch: 1,
    update: typed(client, change),
    stateVector: encoded(stateVectorOf(client)),
  })
}

describe("typing that is still in flight when the Coach or Undo rebuilds a block", () => {
  it("keeps it when the Coach moved the block", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
      await h.coach(docId, 1, [{ op: "move", blockId: "t1", after: "t2" }])
      await syncFrom(docId, client, (paper) =>
        withText(paper, "t1", "First paragraph. INFLIGHT")
      )
      expect(await order(docId)).toBe("s1,t2,t1")
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. INFLIGHT")
    })
  })

  it("keeps it when Undo moves the block back", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const moved = await h.coach(docId, 1, [
        { op: "move", blockId: "t1", after: "t2" },
      ])
      await h.pull(docId, client)
      await h.store.registry.undo(userId, moved.activityId!)
      await syncFrom(docId, client, (paper) =>
        withText(paper, "t1", "First paragraph. INFLIGHT2")
      )
      expect(await order(docId)).toBe("s1,t1,t2")
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. INFLIGHT2")
    })
  })

  it("puts the block back when the Coach removed it", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
      await h.coach(docId, 1, [{ op: "remove", blockId: "t1" }])
      await syncFrom(docId, client, (paper) =>
        withText(paper, "t1", "First paragraph. INFLIGHT3")
      )
      expect(await order(docId)).toBe("s1,t1,t2")
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. INFLIGHT3")
    })
  })
})

describe("Undo and the Coach's words", () => {
  it("leaves no markup behind when the person bolded the Coach's words", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const edited = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph, a big team." },
      ])
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.map((block) =>
              block.id === "t1"
                ? {
                    ...block,
                    content: [
                      { text: "First paragraph, a " },
                      { text: "big", bold: true },
                      { text: " team." },
                    ],
                  }
                : block
            ),
          }) as PaperDocument
      )
      await h.store.registry.undo(userId, edited.activityId!)
      expect((await contentOf(docId, "t1")).content).toEqual([
        { text: "First paragraph." },
      ])
    })
  })

  it("leaves a link on the Coach's words clean too", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const edited = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph at Acme." },
      ])
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.map((block) =>
              block.id === "t1"
                ? {
                    ...block,
                    content: [
                      { text: "First paragraph at " },
                      { text: "Acme", href: "https://acme.example" },
                      { text: "." },
                    ],
                  }
                : block
            ),
          }) as PaperDocument
      )
      await h.store.registry.undo(userId, edited.activityId!)
      expect(await h.textOf(docId, "t1")).toBe("First paragraph.")
    })
  })

  it.each([
    [
      "rewrote a word",
      "First paragraph of five engineers.",
      "First paragraph of four engineers.",
    ],
    ["replaced a word", "First COACH paragraph.", "First CAT paragraph."],
  ])(
    "is refused, writing nothing, when the person %s of the Coach's",
    async (_name, coachText, personText) => {
      await inDatabase(async () => {
        const { docId, client } = await h.created()
        const edited = await h.coach(docId, 1, [
          { op: "setText", blockId: "t1", text: coachText },
        ])
        await h.person(docId, client, (paper) =>
          withText(paper, "t1", personText)
        )
        const rows = await h.rowCount(docId)
        await expect(
          h.store.registry.undo(userId, edited.activityId!)
        ).rejects.toMatchObject({ code: "CONFLICT" })
        expect(await h.rowCount(docId)).toBe(rows)
        expect(await h.textOf(docId, "t1")).toBe(personText)
      })
    }
  )
})

describe("Undo of a child moved out of a parent the Coach then removed", () => {
  it("puts the parent back without the child, then the child back, with unique ids", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const entry = (id: string, bullet: string) => ({
        id,
        type: "experience",
        role: id,
        company: "C",
        period: "",
        location: "",
        children: [
          {
            id: bullet,
            type: "bullet",
            content: [{ text: bullet }],
            children: [],
          },
        ],
      })
      await h.person(
        docId,
        client,
        (paper) =>
          ({
            ...paper,
            blocks: [...paper.blocks, entry("e1", "b1"), entry("e2", "b2")],
          }) as PaperDocument
      )
      const edited = await h.coach(docId, 2, [
        { op: "move", blockId: "b1", after: "b2" },
        { op: "remove", blockId: "e1" },
      ])
      expect(edited.output.outcomes.map((o) => o.status)).toEqual([
        "applied",
        "applied",
      ])
      await h.store.registry.undo(userId, edited.activityId!)
      const shape = (await h.paperOf(docId)).blocks
        .filter((block) => "children" in block)
        .map((block) => [
          block.id,
          (block as { children: { id: string }[] }).children.map((c) => c.id),
        ])
      expect(shape).toEqual([
        ["e1", ["b1"]],
        ["e2", ["b2"]],
      ])
    })
  })
})

describe("a Coach edit that was undone", () => {
  it("does not make a second edit from the same read stale", async () => {
    await inDatabase(async () => {
      const { docId } = await h.created()
      const first = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph. A" },
      ])
      await h.store.registry.undo(userId, first.activityId!)
      const second = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph. B" },
      ])
      expect(second.output.outcomes[0]).toMatchObject({ status: "applied" })
      expect(await h.textOf(docId, "t1")).toContain("B")
    })
  })

  it("keeps a block rebuilt by an edit and its undo from being addressed from an older read", async () => {
    await inDatabase(async () => {
      const { docId } = await h.created()
      const moved = await h.coach(docId, 1, [
        { op: "move", blockId: "t2", after: "@start" },
      ])
      await h.store.registry.undo(userId, moved.activityId!)
      const again = await h.coach(docId, 1, [
        { op: "move", blockId: "t2", after: "@start" },
        { op: "setText", blockId: "t2", text: "Second paragraph. X" },
      ])
      expect(again.output.outcomes.map((o) => o.status)).toEqual([
        "stale",
        "stale",
      ])
      expect(await order(docId)).toBe("s1,t1,t2")
    })
  })
})
