import type { PaperDocument } from "@workspace/domain"
import { mergedUpdate, stateVectorOf, updateSince } from "@workspace/paper-crdt"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { bytesOf, encoded, typed, withText } from "../test/paper-content.js"

const userId = "user-coach-round3"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

const inDatabase = <T>(run: () => Promise<T>) => h.inDatabase(run)

type Client = Awaited<ReturnType<typeof h.created>>["client"]

const send = (
  docId: string,
  update: Uint8Array,
  stateVector: Uint8Array | string
) =>
  h.run("paper.sync", {
    docId,
    epoch: 1,
    update: encoded(update),
    stateVector:
      typeof stateVector === "string" ? stateVector : encoded(stateVector),
  })

const order = async (docId: string) =>
  (await h.paperOf(docId)).blocks.map((block) => block.id).join(",")

const withExperiences = (paper: PaperDocument) => {
  const entry = (id: string, bullet: string) => ({
    id,
    type: "experience",
    role: `Role ${id}`,
    company: "C",
    period: "",
    location: "",
    children: [
      { id: bullet, type: "bullet", content: [{ text: bullet }], children: [] },
    ],
  })
  return {
    ...paper,
    blocks: [...paper.blocks, entry("e1", "b1"), entry("e2", "b2")],
  } as PaperDocument
}

function typeInto(client: Client, id: string, text: string) {
  return typed(client, (paper) => withText(paper, id, text))
}

describe("a client that applied the Coach's row before it flushed its typing", () => {
  it.each([
    ["with its state vector", true],
    ["with an empty state vector", false],
  ])("keeps the pending update's typing %s", async (_name, real) => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
      await h.coach(docId, 1, [{ op: "move", blockId: "t1", after: "t2" }])
      const pending = bytesOf(
        typeInto(client, "t1", "First paragraph. PENDING")
      )
      await h.pull(docId, client)
      await send(docId, pending, real ? stateVectorOf(client) : "")
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. PENDING")
      expect(await order(docId)).toBe("s1,t2,t1")
    })
  })

  it("keeps an in-flight delete in a block that was moved", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
      await h.coach(docId, 1, [{ op: "move", blockId: "t1", after: "t2" }])
      await send(
        docId,
        bytesOf(typeInto(client, "t1", "First.")),
        stateVectorOf(client)
      )
      expect(await h.textOf(docId, "t1")).toBe("First.")
    })
  })

  it("still saves the rest when the client's own document already dropped the typing", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
      const sinceThen = stateVectorOf(client)
      await h.coach(docId, 1, [{ op: "move", blockId: "t1", after: "t2" }])
      typeInto(client, "t1", "First paragraph. PENDING")
      await h.pull(docId, client)
      await send(docId, updateSince(client, sinceThen)!, stateVectorOf(client))
      expect(await order(docId)).toBe("s1,t2,t1")
      expect(await h.textOf(docId, "t1")).toBe("First paragraph.")
    })
  })
})

describe("a normal sync", () => {
  it("does not double what was typed and deleted in the same update", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
      const since = stateVectorOf(client)
      typeInto(client, "t1", "First paragraph.Q AB")
      typeInto(client, "t1", "First paragraph. AB")
      await send(docId, updateSince(client, since)!, stateVectorOf(client))
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. AB")
    })
  })

  it("does not double merged per-transaction updates either", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
      const first = typeInto(client, "t1", "First paragraph.Q AB")
      const second = typeInto(client, "t1", "First paragraph. AB")
      await send(
        docId,
        mergedUpdate([bytesOf(first), bytesOf(second)]),
        stateVectorOf(client)
      )
      expect(await h.textOf(docId, "t1")).toBe("First paragraph. AB")
    })
  })

  it("does not double a field changed twice in one update", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(docId, client, withExperiences)
      const since = stateVectorOf(client)
      for (const role of ["Lead", "Chief"]) {
        typed(
          client,
          (paper) =>
            ({
              ...paper,
              blocks: paper.blocks.map((block) =>
                block.id === "e1" ? { ...block, role } : block
              ),
            }) as PaperDocument
        )
      }
      await send(docId, updateSince(client, since)!, stateVectorOf(client))
      const entry = (await h.paperOf(docId)).blocks.find((b) => b.id === "e1")
      expect(entry).toMatchObject({ role: "Chief" })
    })
  })
})

describe("typing in a bullet whose experience the Coach removed", () => {
  it("brings the experience back around the bullet, and Undo leaves them together", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(docId, client, withExperiences)
      await h.pull(docId, client)
      const removed = await h.coach(docId, 2, [{ op: "remove", blockId: "e1" }])
      const update = typed(
        client,
        (paper) =>
          ({
            ...paper,
            blocks: paper.blocks.map((block) =>
              block.id === "e1" && "children" in block
                ? {
                    ...block,
                    children: [
                      {
                        ...block.children[0]!,
                        content: [{ text: "b1 INFLIGHT" }],
                      },
                    ],
                  }
                : block
            ),
          }) as PaperDocument
      )
      await send(docId, bytesOf(update), stateVectorOf(client))
      const shape = async () =>
        (await h.paperOf(docId)).blocks
          .filter((block) => "children" in block)
          .map((block) => [
            block.id,
            (block as { children: { id: string }[] }).children.map((c) => c.id),
          ])
      expect(await shape()).toEqual([
        ["e1", ["b1"]],
        ["e2", ["b2"]],
      ])
      expect(await order(docId)).toBe("s1,t1,t2,e1,e2")
      await h.store.registry.undo(userId, removed.activityId!)
      expect(await shape()).toEqual([
        ["e1", ["b1"]],
        ["e2", ["b2"]],
      ])
      expect(JSON.stringify(await h.paperOf(docId))).toContain("b1 INFLIGHT")
    })
  })
})

describe("typing in a nested bullet the Coach removed", () => {
  it("puts the bullet back inside its live parent", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(
        docId,
        client,
        (paper) =>
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
                children: [
                  {
                    id: "b1",
                    type: "bullet",
                    content: [{ text: "Bullet one" }],
                    children: [
                      {
                        id: "b1a",
                        type: "bullet",
                        content: [{ text: "Nested" }],
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          }) as PaperDocument
      )
      await h.coach(docId, 2, [{ op: "remove", blockId: "b1a" }])
      await send(
        docId,
        bytesOf(
          typed(
            client,
            (paper) =>
              ({
                ...paper,
                blocks: paper.blocks.map((block) =>
                  block.id === "e1" && "children" in block
                    ? {
                        ...block,
                        children: block.children.map((child) => ({
                          ...child,
                          children: child.children.map((nested) => ({
                            ...nested,
                            content: [{ text: "Nested TOK" }],
                          })),
                        })),
                      }
                    : block
                ),
              }) as PaperDocument
          )
        ),
        stateVectorOf(client)
      )
      const e1 = (await h.paperOf(docId)).blocks.find((b) => b.id === "e1")
      expect(JSON.stringify(e1)).toContain("Nested TOK")
      expect(e1).toMatchObject({
        children: [{ id: "b1", children: [{ id: "b1a" }] }],
      })
    })
  })
})

describe("typing that cannot be carried exactly", () => {
  it("keeps the person's version beside the block and does not refuse the sync", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      const long = "alpha beta gamma delta ".repeat(300)
      await h.person(docId, client, (paper) => withText(paper, "t1", long))
      await h.pull(docId, client)
      await h.coach(docId, 2, [{ op: "move", blockId: "t1", after: "t2" }])
      const mine = `START ${long.replaceAll("beta", "BETA")} END`
      await send(
        docId,
        bytesOf(typeInto(client, "t1", mine)),
        stateVectorOf(client)
      )
      const ids = (await h.paperOf(docId)).blocks.map((block) => block.id)
      expect(ids).toContain("t1")
      expect(ids.some((id) => id.startsWith("t1-mine"))).toBe(true)
      expect(JSON.stringify(await h.paperOf(docId))).toContain("START")
    })
  })

  it("answers a garbage state vector with the plain refusal", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
      await h.coach(docId, 1, [{ op: "move", blockId: "t1", after: "t2" }])
      await expect(
        send(docId, bytesOf(typeInto(client, "t1", "x")), "//////////8=")
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    })
  })
})

const contentOf = async (docId: string, id: string) =>
  (
    (await h.paperOf(docId)).blocks.find((block) => block.id === id) as {
      content: unknown
    }
  ).content

describe("Undo and the marks the person added", () => {
  it("keeps bold on an original word", async () => {
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
                      { text: "First", bold: true },
                      { text: " paragraph, a big team." },
                    ],
                  }
                : block
            ),
          }) as PaperDocument
      )
      await h.store.registry.undo(userId, edited.activityId!)
      expect(await contentOf(docId, "t1")).toEqual([
        { text: "First", bold: true },
        { text: " paragraph." },
      ])
    })
  })

  it("keeps bold that spans original and Coach words, on the original part", async () => {
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
                      { text: "First " },
                      { text: "paragraph, a big", bold: true },
                      { text: " team." },
                    ],
                  }
                : block
            ),
          }) as PaperDocument
      )
      await h.store.registry.undo(userId, edited.activityId!)
      expect(await contentOf(docId, "t1")).toEqual([
        { text: "First " },
        { text: "paragraph", bold: true },
        { text: "." },
      ])
    })
  })
})

describe("Undo of the one op order the edit path accepts", () => {
  it("refuses removing a parent before moving its child, and Undo restores the pair", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(docId, client, withExperiences)
      const swapped = await h.coach(docId, 2, [
        { op: "remove", blockId: "e1" },
        { op: "move", blockId: "b1", after: "b2" },
      ])
      expect(swapped.output.outcomes.map((o) => o.status)).toEqual([
        "applied",
        "invalid",
      ])
      await h.store.registry.undo(userId, swapped.activityId!)
      const e1 = (await h.paperOf(docId)).blocks.find((b) => b.id === "e1")
      expect(e1).toMatchObject({ children: [{ id: "b1" }] })
    })
  })
})
