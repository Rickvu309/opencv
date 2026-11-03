import { upgradeStoredPaper } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { exportAccount } from "../account/index.js"
import { withDatabase } from "../db/context.js"
import { paperDocs, paperShares } from "../db/schema.js"
import { createId } from "../id.js"
import { openStore, twoParagraphCv } from "../test/paper-content.js"

type Store = Awaited<ReturnType<typeof openStore>>
type PaperRow = typeof paperDocs.$inferSelect
type ReadView = { id: string; paper: unknown }

let store: Store

beforeAll(async () => {
  store = await openStore("user-read-paper")
})

afterAll(async () => {
  await store.client.close()
})

async function run(name: string, input: unknown) {
  return store.registry.execute({ name, input, actor: store.actor })
}

async function read(name: string, input: unknown) {
  return store.registry.read(name, input, store.actor) as Promise<
    ReadView | ReadView[]
  >
}

async function rowOf(id: string) {
  const row = (
    await store.db.select().from(paperDocs).where(eq(paperDocs.id, id))
  )[0]
  if (!row) throw new Error(`missing ${id}`)
  return row
}

function unchanged(row: PaperRow) {
  return {
    document: row.document,
    crdtDocument: row.crdtDocument ?? null,
    contentVersion: row.contentVersion,
    crdtEpoch: row.crdtEpoch ?? null,
    crdtBase: row.crdtBase
      ? Buffer.from(row.crdtBase).toString("base64")
      : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

describe("readers return v3 paper without writing", () => {
  it("returns the seeded document and the upgrade of an unseeded row", async () => {
    await withDatabase(store.db, async () => {
      const created = await run("paper.create", {
        kind: "cv",
        name: "Seeded",
        document: twoParagraphCv,
      })
      const seededId = (created.output as { id: string }).id
      const shared = await run("paper.share", { docId: seededId })
      const seededToken = (shared.output as { token: string }).token
      const seededRow = await rowOf(seededId)
      const seededBefore = unchanged(seededRow)

      const rawId = createId()
      const rawToken = "unseeded-share-token"
      await store.db.insert(paperDocs).values({
        id: rawId,
        userId: store.actor.userId,
        name: "Raw",
        kind: "cv",
        document: twoParagraphCv,
        contentVersion: 4,
      })
      await store.db.insert(paperShares).values({
        id: createId(),
        docId: rawId,
        token: rawToken,
      })
      const rawBefore = unchanged(await rowOf(rawId))
      const expected = upgradeStoredPaper("cv", twoParagraphCv)
      expect(expected.ok).toBe(true)
      if (!expected.ok) return

      const seededGet = (await read("paper.get", {
        docId: seededId,
      })) as ReadView
      const rawGet = (await read("paper.get", { docId: rawId })) as ReadView
      const list = (await read("paper.list", {})) as ReadView[]
      const seededShared = (await read("paper.shared", {
        token: seededToken,
      })) as ReadView
      const rawShared = (await read("paper.shared", {
        token: rawToken,
      })) as ReadView
      const exported = await exportAccount(store.actor.userId)
      const exportedRaw = exported.documents.find((doc) => doc.id === rawId)
      const exportedSeeded = exported.documents.find(
        (doc) => doc.id === seededId
      )

      expect(seededGet.paper).toEqual(seededRow.crdtDocument)
      expect(rawGet.paper).toEqual(expected.document)
      expect(list.find((item) => item.id === seededId)?.paper).toEqual(
        seededRow.crdtDocument
      )
      expect(list.find((item) => item.id === rawId)?.paper).toEqual(
        expected.document
      )
      expect(seededShared.paper).toEqual(seededRow.crdtDocument)
      expect(rawShared.paper).toEqual(expected.document)
      expect(exportedSeeded?.paper).toEqual(seededRow.crdtDocument)
      expect(exportedRaw?.paper).toEqual(expected.document)
      expect(unchanged(await rowOf(seededId))).toEqual(seededBefore)
      expect(unchanged(await rowOf(rawId))).toEqual(rawBefore)
      expect(rawBefore.crdtDocument).toBeNull()
    })
  })
})
