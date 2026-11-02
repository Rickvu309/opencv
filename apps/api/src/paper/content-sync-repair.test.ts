import type { PaperDocument } from "@workspace/domain"
import { stateVectorOf } from "@workspace/paper-crdt"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import {
  bytesOf,
  clientFrom,
  encoded,
  typed,
  withText,
} from "../test/paper-content.js"

const userId = "user-sync-repair"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

type Client = Awaited<ReturnType<typeof h.created>>["client"]
type Node = {
  id: string
  type: string
  content?: { text: string }[]
  children?: Node[]
}

const bullet = (id: string, text: string) => ({
  id,
  type: "bullet",
  content: [{ text }],
  children: [],
})

const withExperiences = (paper: PaperDocument) =>
  ({
    ...paper,
    blocks: [
      ...paper.blocks,
      {
        id: "e1",
        type: "experience",
        role: "A",
        company: "B",
        period: "",
        location: "",
        children: [bullet("b1", "Bullet one"), bullet("b1b", "Bullet one-b")],
      },
      {
        id: "e2",
        type: "experience",
        role: "C",
        company: "D",
        period: "",
        location: "",
        children: [bullet("b2", "Bullet two")],
      },
    ],
  }) as PaperDocument

const reorder = (paper: PaperDocument, ids: string[]) =>
  ({
    ...paper,
    blocks: ids.map((id) => paper.blocks.find((block) => block.id === id)!),
  }) as PaperDocument

const send = (docId: string, update: Uint8Array, client: Client) =>
  h.run("paper.sync", {
    docId,
    epoch: 1,
    update: encoded(update),
    stateVector: encoded(stateVectorOf(client)),
  })

const ids = (nodes: Node[]): string[] =>
  nodes.flatMap((node) => [node.id, ...ids(node.children ?? [])])

const textOf = (nodes: Node[]): string =>
  nodes
    .flatMap((node) => [
      (node.content ?? []).map((run) => run.text).join(""),
      textOf(node.children ?? []),
    ])
    .join("|")

async function blocks(docId: string) {
  return (await h.paperOf(docId)).blocks as unknown as Node[]
}

async function expectRepaired(
  docId: string,
  update: Uint8Array,
  client: Client
) {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
  const reply = await send(docId, update, client)
  expect(reply.output).toMatchObject({ reset: false })
  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
  const all = ids(await blocks(docId))
  expect(new Set(all).size).toBe(all.length)
  return reply
}

async function laterTypingIsAbsorbed(
  docId: string,
  client: Client,
  pull = true
) {
  if (pull) await h.pull(docId, client)
  const later = bytesOf(
    typed(client, (paper) => withText(paper, "t2", "Second paragraph. LATER"))
  )
  await send(docId, later, client)
  expect(await h.textOf(docId, "t2")).toContain("LATER")
}

describe("a stale client that moves a block someone else rebuilt", () => {
  it("is repaired when the Coach moved the same block", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.coach(docId, 1, [{ op: "move", blockId: "t2", after: "s1" }])
      const update = bytesOf(
        typed(client, (p) => reorder(p, ["s1", "t2", "t1"]))
      )
      await expectRepaired(docId, update, client)
      expect((await blocks(docId)).map((b) => b.id)).toEqual(["s1", "t2", "t1"])
      expect(textOf(await blocks(docId))).toContain("Second paragraph.")
      await laterTypingIsAbsorbed(docId, client)
    })
  })

  it("is repaired when the Coach made the same move", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.coach(docId, 1, [{ op: "move", blockId: "t1", after: "t2" }])
      const update = bytesOf(
        typed(client, (p) => reorder(p, ["s1", "t2", "t1"]))
      )
      await expectRepaired(docId, update, client)
      expect((await blocks(docId)).map((b) => b.id)).toEqual(["s1", "t2", "t1"])
      await laterTypingIsAbsorbed(docId, client)
    })
  })

  it("is repaired when a nested bullet is dragged into a block the Coach moved", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(docId, client, withExperiences)
      await h.pull(docId, client)
      await h.coach(docId, 2, [{ op: "move", blockId: "e1", after: "e2" }])
      const update = bytesOf(
        typed(
          client,
          (paper) =>
            ({
              ...paper,
              blocks: paper.blocks.map((block) =>
                block.id === "e1" && "children" in block
                  ? { ...block, children: [block.children[1]] }
                  : block.id === "e2" && "children" in block
                    ? {
                        ...block,
                        children: [
                          ...block.children,
                          bullet("b1", "Bullet one"),
                        ],
                      }
                    : block
              ),
            }) as PaperDocument
        )
      )
      await expectRepaired(docId, update, client)
      expect(textOf(await blocks(docId))).toContain("Bullet one")
    })
  })

  it("is repaired when Undo moved the block back and the stale client moved it back too", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      const moved = await h.coach(docId, 1, [
        { op: "move", blockId: "t1", after: "t2" },
      ])
      await h.pull(docId, client)
      await h.run("paper.revertEdit", { docId, editId: moved.output.editId })
      const update = bytesOf(
        typed(client, (p) => reorder(p, ["s1", "t1", "t2"]))
      )
      await expectRepaired(docId, update, client)
      expect((await blocks(docId)).map((b) => b.id)).toEqual(["s1", "t1", "t2"])
    })
  })

  it("is repaired when two tabs both move the same block", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      const pulled = await h.run("paper.sync", {
        docId,
        epoch: 0,
        update: "",
        stateVector: "",
      })
      const other = clientFrom((pulled.output as { update: string }).update)
      await h.person(docId, client, (p) => reorder(p, ["s1", "t2", "t1"]))
      const update = bytesOf(
        typed(other, (p) => reorder(p, ["s1", "t2", "t1"]))
      )
      await expectRepaired(docId, update, other)
      expect((await blocks(docId)).map((b) => b.id)).toEqual(["s1", "t2", "t1"])
    })
  })
})

describe("a stale client that adds an entry while the Coach moves or removes the section", () => {
  const entry = {
    id: "ne",
    type: "experience",
    role: "New role",
    company: "Co",
    period: "",
    location: "",
    children: [bullet("nb", "Done a thing")],
  }

  it("keeps the entry after a section the Coach moved to the end", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      const edit = await h.coach(docId, 1, [
        { op: "move", blockId: "s1", after: "t2" },
      ])
      expect(edit.output.outcomes[0]).toMatchObject({ status: "applied" })
      const update = bytesOf(
        typed(
          client,
          (p) =>
            ({
              ...p,
              blocks: [p.blocks[0], p.blocks[1], entry, p.blocks[2]],
            }) as PaperDocument
        )
      )
      await expectRepaired(docId, update, client)
      const all = await blocks(docId)
      const sectionAt = all.findIndex((b) => b.type === "section")
      const entryAt = all.findIndex((b) => b.id === "ne")
      expect(sectionAt).toBeGreaterThanOrEqual(0)
      expect(entryAt).toBeGreaterThan(sectionAt)
      expect(textOf(all)).toContain("Done a thing")
      await laterTypingIsAbsorbed(docId, client)
    })
  })

  it("puts a section back when the Coach removed the only one", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      const edit = await h.coach(docId, 1, [{ op: "remove", blockId: "s1" }])
      expect(edit.output.outcomes[0]).toMatchObject({ status: "applied" })
      const update = bytesOf(
        typed(
          client,
          (p) => ({ ...p, blocks: [...p.blocks, entry] }) as PaperDocument
        )
      )
      await expectRepaired(docId, update, client)
      const all = await blocks(docId)
      expect(all.some((b) => b.type === "section")).toBe(true)
      expect(textOf(all)).toContain("Done a thing")
    })
  })

  it("refuses a Coach move or remove of a section that would orphan a live entry", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(docId, client, withExperiences)
      const result = await h.coach(docId, 2, [
        { op: "remove", blockId: "s1" },
        { op: "move", blockId: "s1", after: "e2" },
      ])
      expect(result.output.outcomes.map((o) => o.status)).toEqual([
        "invalid",
        "invalid",
      ])
    })
  })
})

describe("a client that splits a block the Coach moved", () => {
  it("keeps every word, once per half, until the step 5 rebase", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.coach(docId, 1, [{ op: "move", blockId: "t1", after: "t2" }])
      const update = bytesOf(
        typed(
          client,
          (paper) =>
            ({
              ...paper,
              blocks: paper.blocks.flatMap((block): unknown[] =>
                block.id === "t1"
                  ? [
                      { ...block, content: [{ text: "First" }] },
                      {
                        id: "tnew",
                        type: "paragraph",
                        content: [{ text: " paragraph." }],
                      },
                    ]
                  : [block]
              ),
            }) as PaperDocument
        )
      )
      await expectRepaired(docId, update, client)
      const text = textOf(await blocks(docId))
      expect(text).toContain("First paragraph.")
      expect(text.split(" paragraph.").length - 1).toBe(3)
    })
  })
})

const CLIENT_IDS = [0, 4_294_967_295]

describe.each(CLIENT_IDS)(
  "a repair with the tab's client id %i",
  (clientID) => {
    async function staleMove(coachEdit: unknown[]) {
      const { docId, client } = await h.created()
      client.clientID = clientID
      await h.pull(docId, client)
      const coach = await h.coach(docId, 1, coachEdit)
      const update = bytesOf(
        typed(client, (p) => reorder(p, ["s1", "t2", "t1"]))
      )
      await expectRepaired(docId, update, client)
      return { docId, client, coach }
    }

    const moveAndRewrite = [
      { op: "move", blockId: "t2", after: "s1" },
      { op: "setText", blockId: "t2", text: "Second paragraph. COACH" },
    ]

    it("keeps the Coach's copy of a pure stale move, once, and Undo works", async () => {
      await h.inDatabase(async () => {
        const { docId, coach } = await staleMove(moveAndRewrite)
        const all = await blocks(docId)
        expect(all.map((b) => b.id)).toEqual(["s1", "t2", "t1"])
        expect(textOf(all)).toContain("Second paragraph. COACH")
        await h.store.registry.undo(userId, coach.activityId!)
        const undone = await blocks(docId)
        expect(undone.map((b) => b.id)).toEqual(["s1", "t1", "t2"])
        expect(textOf(undone)).not.toContain("COACH")
      })
    })

    it("makes an old Coach read of the block stale and a fresh one apply", async () => {
      await h.inDatabase(async () => {
        const { docId, coach } = await staleMove([
          { op: "move", blockId: "t2", after: "s1" },
        ])
        const old = await h.coach(docId, coach.output.revision, [
          { op: "setText", blockId: "t2", text: "Second paragraph. OLD" },
        ])
        expect(old.output.outcomes[0]).toMatchObject({ status: "stale" })
        const revision = (await h.rowCount(docId)) + 1
        const fresh = await h.coach(docId, revision, [
          { op: "setText", blockId: "t2", text: "Second paragraph. NEW" },
        ])
        expect(fresh.output.outcomes[0]).toMatchObject({ status: "applied" })
        expect(await h.textOf(docId, "t2")).toContain("NEW")
      })
    })

    it("keeps the tab's own container so typing sent before the reply is absorbed", async () => {
      await h.inDatabase(async () => {
        const { docId, client } = await staleMove([
          { op: "move", blockId: "t2", after: "s1" },
        ])
        await laterTypingIsAbsorbed(docId, client, false)
      })
    })
  }
)
