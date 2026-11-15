import { ERROR_CODES } from "@workspace/domain"
import { FRAGMENT } from "@workspace/paper-crdt"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { withDatabase } from "../db/context.js"
import { paperDocUpdates, paperDocs } from "../db/schema.js"
import {
  clientFrom,
  encoded,
  openStore,
  twoParagraphCv,
  typed,
  withText,
} from "../test/paper-content.js"

type Store = Awaited<ReturnType<typeof openStore>>

let store: Store

beforeAll(async () => {
  store = await openStore("user-content-store")
})

afterAll(async () => {
  await store.client.close()
})

async function sync(docId: string, push: string, epoch = 1) {
  const result = await store.registry.execute({
    name: "paper.sync",
    input: { docId, epoch, update: push, stateVector: "" },
    actor: store.actor,
  })
  return result.output as {
    epoch: number
    revision: number
    reset: boolean
    stale: boolean
    update: string
    stateVector: string
  }
}

async function created(name: string) {
  const result = await store.registry.execute({
    name: "paper.create",
    input: { kind: "cv", name, document: twoParagraphCv },
    actor: store.actor,
  })
  return (result.output as { id: string }).id
}

async function snapshot(docId: string) {
  const rows = await store.db
    .select()
    .from(paperDocUpdates)
    .where(eq(paperDocUpdates.paperId, docId))
  const doc = (
    await store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
  )[0]!
  return {
    seqs: rows.map((row) => row.seq).sort((a, b) => a - b),
    document: doc.crdtDocument,
    crdtDocument: doc.crdtDocument,
    revision: doc.contentVersion,
  }
}

describe("paper.sync", () => {
  it("stores nothing for a resent push", async () => {
    await withDatabase(store.db, async () => {
      const docId = await created("Resend")
      const client = clientFrom((await sync(docId, "", 0)).update)
      const push = typed(client, (paper) =>
        withText(paper, "t1", "First paragraph, edited.")
      )
      const first = await sync(docId, push)
      expect(first.revision).toBe(2)
      const again = await sync(docId, push)
      expect(again.revision).toBe(2)
      expect((await snapshot(docId)).seqs).toEqual([2])
    })
  })

  it("answers the second of two concurrent pushes stale, then keeps both after a resend", async () => {
    await withDatabase(store.db, async () => {
      const docId = await created("Concurrent")
      const pulled = (await sync(docId, "", 0)).update
      const pushA = typed(clientFrom(pulled), (paper) =>
        withText(paper, "t1", "Typed by tab A.")
      )
      const pushB = typed(clientFrom(pulled), (paper) =>
        withText(paper, "t2", "Typed by tab B.")
      )
      const replies = await Promise.all([
        sync(docId, pushA),
        sync(docId, pushB),
      ])
      expect(replies.filter((reply) => reply.stale)).toHaveLength(1)
      await sync(docId, pushA)
      await sync(docId, pushB)
      const after = await snapshot(docId)
      expect(after.seqs).toEqual([2, 3])
      expect(after.revision).toBe(3)
      const text = JSON.stringify(after.document)
      expect(text).toContain("Typed by tab A.")
      expect(text).toContain("Typed by tab B.")
      expect(JSON.stringify(after.crdtDocument)).toContain("Typed by tab B.")
    })
  })

  it("repairs a too-deep list, rolls back an unreadable update and accepts the next valid one", async () => {
    await withDatabase(store.db, async () => {
      const docId = await created("Invalid")
      const pulled = (await sync(docId, "", 0)).update
      const clientWithDeepList = clientFrom(pulled)
      const deepUpdate: Uint8Array[] = []
      clientWithDeepList.on("update", (update: Uint8Array) =>
        deepUpdate.push(update)
      )
      const root = clientWithDeepList.getXmlFragment(FRAGMENT).get(0)
      if (!("nodeName" in root)) throw new Error("Missing root")
      const element = (name: string) => {
        const node = root.clone()
        node.nodeName = name
        node.delete(0, node.length)
        return node
      }
      const findText = (
        node: typeof root
      ):
        | Extract<ReturnType<typeof root.toArray>[number], { toDelta: unknown }>
        | undefined => {
        for (const child of node.toArray()) {
          if ("nodeName" in child) {
            const text = findText(child)
            if (text) return text
          } else if ("toDelta" in child && child.length) return child
        }
        return undefined
      }
      const originalText = findText(root)
      if (!originalText) throw new Error("Missing text")
      const itemAt = (level: number): typeof root => {
        const container = element("blockContainer")
        container.setAttribute("id", `deep-${level}`)
        const item = element("bulletListItem")
        const text = originalText.clone()
        text.delete(0, text.length)
        text.insert(0, "five")
        item.insert(0, [text])
        container.insert(0, [item])
        if (level < 5) {
          const children = element("blockGroup")
          children.insert(0, [itemAt(level + 1)])
          container.insert(1, [children])
        }
        return container
      }
      clientWithDeepList.transact(() => root.insert(root.length, [itemAt(1)]))
      const tooDeep = encoded(deepUpdate[0] ?? null)
      await sync(docId, tooDeep)
      const before = await snapshot(docId)
      expect(JSON.stringify(before.document)).toContain("five")
      expect(JSON.stringify(before.document)).toContain("deep-1")

      const client = clientFrom(pulled)
      typed(client, (paper) => withText(paper, "t1", "Local only"))
      const second = typed(client, (paper) =>
        withText(paper, "t1", "Local only, then more")
      )
      await expect(sync(docId, second)).rejects.toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: expect.stringMatching(/lacks/i),
      })
      expect(await snapshot(docId)).toEqual(before)

      const valid = typed(clientFrom(pulled), (paper) =>
        withText(paper, "t2", "Fine after a refusal")
      )
      const reply = await sync(docId, valid)
      expect(reply.revision).toBe(before.revision + 1)
      expect(JSON.stringify((await snapshot(docId)).document)).toContain(
        "Fine after a refusal"
      )
    })
  })

  it("tells a stale epoch to reset and writes nothing", async () => {
    await withDatabase(store.db, async () => {
      const docId = await created("Stale")
      const before = await snapshot(docId)
      const push = typed(
        clientFrom((await sync(docId, "", 0)).update),
        (paper) => withText(paper, "t1", "Never stored")
      )
      const reply = await sync(docId, push, 7)
      expect(reply.reset).toBe(true)
      expect(reply.epoch).toBe(1)
      expect(reply.update).not.toBe(encoded(null))
      expect(await snapshot(docId)).toEqual(before)
    })
  })
})
