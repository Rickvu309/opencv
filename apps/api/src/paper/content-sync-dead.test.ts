import type { PaperDocument } from "@workspace/domain"
import { stateVectorOf } from "@workspace/paper-crdt"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { encoded, typed, withText } from "../test/paper-content.js"

const userId = "user-sync-dead"
let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

type Client = Awaited<ReturnType<typeof h.created>>["client"]
type Node = { id: string; children?: Node[]; content?: { text: string }[] }

const bullet = (id: string, text: string): Node =>
  ({
    id,
    type: "bullet",
    content: [{ text }],
    children: [],
  }) as Node

function withExperience(paper: PaperDocument) {
  return {
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
        children: [bullet("b1", "Bullet one"), bullet("b2", "Bullet two")],
      },
    ],
  } as PaperDocument
}

function inE1(paper: PaperDocument, change: (children: Node[]) => Node[]) {
  return {
    ...paper,
    blocks: paper.blocks.map((block) =>
      block.id === "e1" && "children" in block
        ? { ...block, children: change(block.children as unknown as Node[]) }
        : block
    ),
  } as PaperDocument
}

async function setup(removeParent: boolean) {
  const { docId, client } = await h.created()
  await h.person(docId, client, withExperience)
  await h.pull(docId, client)
  if (removeParent) {
    await h.coach(docId, 2, [{ op: "remove", blockId: "e1" }])
  } else {
    await h.coach(docId, 2, [{ op: "move", blockId: "t1", after: "t2" }])
  }
  return { docId, client }
}

async function absorbed(
  docId: string,
  client: Client,
  updates: Uint8Array[],
  expectedRows: number
) {
  const spies = (["warn", "error", "log"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => undefined)
  )
  const before = JSON.stringify((await h.paperOf(docId)).blocks)
  const rows = await h.rowCount(docId)
  for (const update of updates) {
    const reply = await h.run("paper.sync", {
      docId,
      epoch: 1,
      update: encoded(update),
      stateVector: encoded(stateVectorOf(client)),
    })
    expect(reply.output).toMatchObject({ reset: false })
  }
  const after = (await h.paperOf(docId)).blocks
  expect(await h.rowCount(docId)).toBe(rows + expectedRows)
  expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true)
  spies.forEach((spy) => spy.mockRestore())
  return {
    before: JSON.parse(before) as Node[],
    after: after as unknown as Node[],
  }
}

const bytes = (update: string) => new Uint8Array(Buffer.from(update, "base64"))

function ids(nodes: Node[]): string[] {
  return nodes.flatMap((node) => [node.id, ...ids(node.children ?? [])])
}

function expectLiveUnchanged(before: Node[], after: Node[]) {
  expect(ids(after)).toEqual(ids(before))
  for (const block of before) {
    expect(after.find((candidate) => candidate.id === block.id)).toEqual(block)
  }
}

describe("a sync whose items land in a block a Coach move rebuilt", () => {
  it.each([
    ["inserts text", "First paragraph. NEW", 1],
    ["deletes text", "First.", 0],
  ])("absorbs a client that %s", async (_name, text, rows) => {
    await h.inDatabase(async () => {
      const { docId, client } = await setup(false)
      const update = bytes(
        typed(client, (paper) => withText(paper, "t1", text))
      )
      const result = await absorbed(docId, client, [update], rows)
      expectLiveUnchanged(result.before, result.after)
    })
  })

  it("absorbs a client that only changes marks", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await setup(false)
      const update = bytes(
        typed(
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
                        { text: " paragraph." },
                      ],
                    }
                  : block
              ),
            }) as PaperDocument
        )
      )
      const result = await absorbed(docId, client, [update], 1)
      expectLiveUnchanged(result.before, result.after)
    })
  })

  it("absorbs two chained updates", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await setup(false)
      const first = bytes(
        typed(client, (paper) => withText(paper, "t1", "First paragraph. A"))
      )
      const second = bytes(
        typed(client, (paper) => withText(paper, "t1", "First paragraph. A B"))
      )
      const result = await absorbed(docId, client, [first, second], 2)
      expectLiveUnchanged(result.before, result.after)
    })
  })
})

describe("a sync whose items land in a block a Coach remove took away", () => {
  it.each([
    [
      "adds a block",
      (children: Node[]) => [...children, bullet("n1", "Added")],
    ],
    [
      "splits a block",
      (children: Node[]) => [
        { ...children[0]!, content: [{ text: "Bullet" }] },
        bullet("n2", " one"),
        children[1]!,
      ],
    ],
    [
      "merges two blocks",
      (children: Node[]) => [
        { ...children[0]!, content: [{ text: "Bullet one Bullet two" }] },
      ],
    ],
    [
      "types in a block",
      (children: Node[]) => [
        { ...children[0]!, content: [{ text: "Bullet one TYPED" }] },
        children[1]!,
      ],
    ],
  ])("absorbs a client that %s", async (_name, change) => {
    await h.inDatabase(async () => {
      const { docId, client } = await setup(true)
      const update = bytes(typed(client, (paper) => inE1(paper, change)))
      const result = await absorbed(docId, client, [update], 1)
      expectLiveUnchanged(result.before, result.after)
    })
  })

  it("absorbs two chained updates", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await setup(true)
      const first = bytes(
        typed(client, (paper) =>
          inE1(paper, (children) => [...children, bullet("n3", "One")])
        )
      )
      const second = bytes(
        typed(client, (paper) =>
          inE1(paper, (children) => [
            ...children.slice(0, 2),
            bullet("n3", "One more"),
          ])
        )
      )
      const result = await absorbed(docId, client, [first, second], 2)
      expectLiveUnchanged(result.before, result.after)
    })
  })
})
