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

describe("a sync with a state vector the server cannot read", () => {
  it("is refused plainly", async () => {
    await inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.pull(docId, client)
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
