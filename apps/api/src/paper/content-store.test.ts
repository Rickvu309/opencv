import { ERROR_CODES, type PaperDocument } from "@workspace/domain"
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
    document: doc.document,
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

  it("serialises two concurrent pushes and keeps both", async () => {
    await withDatabase(store.db, async () => {
      const docId = await created("Concurrent")
      const pulled = (await sync(docId, "", 0)).update
      const pushA = typed(clientFrom(pulled), (paper) =>
        withText(paper, "t1", "Typed by tab A.")
      )
      const pushB = typed(clientFrom(pulled), (paper) =>
        withText(paper, "t2", "Typed by tab B.")
      )
      await Promise.all([sync(docId, pushA), sync(docId, pushB)])
      const after = await snapshot(docId)
      expect(after.seqs).toEqual([2, 3])
      expect(after.revision).toBe(3)
      const text = JSON.stringify(after.document)
      expect(text).toContain("Typed by tab A.")
      expect(text).toContain("Typed by tab B.")
      expect(JSON.stringify(after.crdtDocument)).toContain("Typed by tab B.")
    })
  })

  it("rolls back an invalid update and accepts the next valid one", async () => {
    await withDatabase(store.db, async () => {
      const docId = await created("Invalid")
      const pulled = (await sync(docId, "", 0)).update
      const before = await snapshot(docId)
      const tooDeep = typed(clientFrom(pulled), (paper) => {
        let item = {
          id: "deep-5",
          type: "bullet",
          content: [{ text: "five" }],
          children: [],
        }
        for (const level of [4, 3, 2, 1]) {
          item = { ...item, id: `deep-${level}`, children: [item] } as never
        }
        return { ...paper, blocks: [...paper.blocks, item] } as PaperDocument
      })
      await expect(sync(docId, tooDeep)).rejects.toMatchObject({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: expect.stringMatching(/nest/i),
      })
      expect(await snapshot(docId)).toEqual(before)

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
