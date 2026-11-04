import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { exportAccount } from "../account/index.js"
import { withDatabase } from "../db/context.js"
import { paperDocs, paperShares } from "../db/schema.js"
import { createId } from "../id.js"
import { openStore, twoParagraphCv } from "../test/paper-content.js"
import { readSharedPhoto } from "./store.js"

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
    crdtDocument: row.crdtDocument ?? null,
    contentVersion: row.contentVersion,
    crdtEpoch: row.crdtEpoch ?? null,
    crdtBase: row.crdtBase
      ? Buffer.from(row.crdtBase).toString("base64")
      : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function textOf(value: unknown) {
  return JSON.stringify(value)
}

function expectStoredV3(paper: unknown) {
  const text = textOf(paper)
  expect(text).toContain("Selected roles")
  expect(text).toContain('"bold":true')
  expect(text).toContain('"level":3')
}

async function insertRow(values: {
  id: string
  name: string
  kind: "cv" | "letter"
  crdtDocument?: unknown
  token?: string
}) {
  await store.db.insert(paperDocs).values({
    id: values.id,
    userId: store.actor.userId,
    name: values.name,
    kind: values.kind,
    ...(values.crdtDocument === undefined
      ? {}
      : { crdtDocument: values.crdtDocument as Record<string, unknown> }),
    contentVersion: 4,
  })
  if (!values.token) return
  await store.db.insert(paperShares).values({
    id: createId(),
    docId: values.id,
    token: values.token,
  })
}

describe("readers return v3 paper without writing", () => {
  it("returns marks from the stored snapshot", async () => {
    await withDatabase(store.db, async () => {
      const created = await run("paper.create", {
        kind: "cv",
        name: "Seeded",
        document: twoParagraphCv,
      })
      const seededId = (created.output as { id: string }).id
      const createdRow = await rowOf(seededId)
      const edited = await run("paper.edit", {
        docId: seededId,
        basedOn: createdRow.contentVersion,
        edits: [
          { op: "setText", blockId: "s1", text: "Selected roles" },
          { op: "setText", blockId: "t1", text: "**First** paragraph." },
          {
            op: "insert",
            after: "t2",
            blocks: [{ type: "heading", level: 3, text: "Depth" }],
          },
        ],
      })
      expect(edited.output).toMatchObject({
        outcomes: [
          { status: "applied" },
          { status: "applied" },
          { status: "applied" },
        ],
      })
      const shared = await run("paper.share", { docId: seededId })
      const seededToken = (shared.output as { token: string }).token
      const seededRow = await rowOf(seededId)
      const seededBefore = unchanged(seededRow)
      const seededGet = (await read("paper.get", {
        docId: seededId,
      })) as ReadView
      const list = (await read("paper.list", {})) as ReadView[]
      const seededShared = (await read("paper.shared", {
        token: seededToken,
      })) as ReadView
      const exported = await exportAccount(store.actor.userId)
      const exportedSeeded = exported.documents.find(
        (doc) => doc.id === seededId
      )

      expectStoredV3(seededRow.crdtDocument)
      expect(seededGet.paper).toEqual(seededRow.crdtDocument)
      expect(list.find((item) => item.id === seededId)?.paper).toEqual(
        seededRow.crdtDocument
      )
      expect(seededShared.paper).toEqual(seededRow.crdtDocument)
      expect(exportedSeeded?.paper).toEqual(seededRow.crdtDocument)
      expect(unchanged(await rowOf(seededId))).toEqual(seededBefore)
    })
  })

  it("refuses a snapshot that is missing or the wrong kind", async () => {
    await withDatabase(store.db, async () => {
      const brokenId = createId()
      await insertRow({
        id: brokenId,
        name: "Broken snapshot",
        kind: "cv",
        crdtDocument: { version: 3 },
      })
      const mismatchedId = createId()
      await insertRow({
        id: mismatchedId,
        name: "Mismatched kind",
        kind: "cv",
        crdtDocument: {
          version: 3,
          kind: "letter",
          blocks: [
            {
              id: "l-1",
              type: "paragraph",
              content: [{ text: "Hello from the letter" }],
            },
          ],
          clashes: [],
        },
      })
      const list = (await read("paper.list", {})) as ReadView[]
      expect(list.find((item) => item.id === brokenId)).toBeUndefined()
      expect(list.find((item) => item.id === mismatchedId)).toBeUndefined()
      await expect(
        store.registry.read("paper.get", { docId: brokenId }, store.actor)
      ).rejects.toMatchObject({ code: "INTERNAL_ERROR" })
      await expect(
        store.registry.read("paper.get", { docId: mismatchedId }, store.actor)
      ).rejects.toMatchObject({ code: "INTERNAL_ERROR" })
      await expect(
        store.registry.read("paper.outline", { docId: brokenId }, store.actor)
      ).rejects.toMatchObject({ code: "INTERNAL_ERROR" })
    })
  })

  it("keeps one unreadable row from blanking the library and the export", async () => {
    await withDatabase(store.db, async () => {
      const sibling = await run("paper.create", {
        kind: "cv",
        name: "Sibling",
        document: twoParagraphCv,
      })
      const siblingId = (sibling.output as { id: string }).id
      const badId = createId()
      const badToken = "unreadable-share-token"
      await insertRow({
        id: badId,
        name: "Unreadable",
        kind: "letter",
        token: badToken,
      })

      const list = (await read("paper.list", {})) as ReadView[]
      expect(list.find((item) => item.id === siblingId)?.paper).toBeDefined()
      expect(list.find((item) => item.id === badId)).toBeUndefined()

      const exported = await exportAccount(store.actor.userId)
      const exportedBad = exported.documents.find((doc) => doc.id === badId)
      const exportedSibling = exported.documents.find(
        (doc) => doc.id === siblingId
      )
      expect(exportedBad?.paper).toBeNull()
      expect(exportedSibling?.paper).toBeDefined()

      await expect(
        store.registry.read("paper.get", { docId: badId }, store.actor)
      ).rejects.toMatchObject({ code: "INTERNAL_ERROR" })
      await expect(
        store.registry.read("paper.outline", { docId: badId }, store.actor)
      ).rejects.toMatchObject({ code: "INTERNAL_ERROR" })
      await expect(readSharedPhoto(badToken)).rejects.toMatchObject({
        code: "NOT_FOUND",
      })
    })
  })
})
