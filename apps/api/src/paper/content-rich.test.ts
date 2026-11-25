import {
  blankCv,
  blankLetter,
  nativeProvenance,
  nativeSyncOutputSchema,
  NATIVE_WRITER,
  RICH_NATIVE_WRITER,
  paperPhotoRef,
  paperViewSchema,
  parseUserId,
  parsePaperId,
  richPaperDocumentSchema,
} from "@workspace/domain"
import {
  loadYDoc,
  materializeStored,
  openRichPaperClient,
} from "@workspace/paper-crdt"
import * as Y from "yjs"
import { and, eq, sql } from "drizzle-orm"
import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { getDb, withDatabase, transaction } from "../db/context.js"
import { paperDocs, paperDocUpdates, activity } from "../db/schema.js"
import { openStore } from "../test/paper-content.js"
import {
  richPaper,
  richElement as element,
  richText as textOf,
  richFragment as fragment,
} from "../test/rich-paper.js"
import { seedColumns } from "./content-document.js"
import { syncContent } from "./content-store.js"
import { foldSettledLog } from "./content-compact.js"
import { saveFile } from "./store.js"
import { png } from "./photo.fixtures.js"

const owner = parseUserId("rich-storage-admission")
let store: Awaited<ReturnType<typeof openStore>>
beforeAll(async () => {
  store = await openStore(owner)
})
afterAll(async () => {
  await store.client.close()
})
const inDatabase = <T>(run: () => Promise<T>) => withDatabase(store.db, run)
const execute = (name: string, input: unknown) =>
  store.registry.execute({ name, input, actor: store.actor })

async function seeded(kind: "cv" | "letter") {
  const file = await saveFile({
    userId: owner,
    name: "portrait.png",
    mediaType: "image/png",
    bytes: Buffer.from(png),
    purpose: "avatar",
  })
  const document = richPaper(kind, paperPhotoRef(file.id))
  const view = paperViewSchema.parse(
    (
      await execute("paper.create", {
        kind,
        document: kind === "cv" ? blankCv() : blankLetter(),
      })
    ).output
  )
  await getDb()
    .update(paperDocs)
    .set(seedColumns(kind, document))
    .where(eq(paperDocs.id, view.id))
  return { docId: view.id, document, fileId: file.id }
}
async function snapshot(docId: string) {
  const [row] = await getDb()
    .select()
    .from(paperDocs)
    .where(eq(paperDocs.id, docId))
  if (!row) throw new Error("Missing Paper")
  const log = await getDb()
    .select()
    .from(paperDocUpdates)
    .where(eq(paperDocUpdates.paperId, docId))
  return { row, log }
}
async function richClient(
  docId: string,
  document: ReturnType<typeof richPaper>
) {
  const client = openRichPaperClient(null, {
    provenance: nativeProvenance(document),
  })
  const sent = client.prepare()
  const reply = await syncContent(owner, parsePaperId(docId), {
    ...sent,
    writer: RICH_NATIVE_WRITER,
  })
  expect(client.receive(sent, reply).failed).toBe(false)
  return client
}
async function push(
  docId: string,
  client: Awaited<ReturnType<typeof richClient>>
) {
  const sent = client.prepare()
  const result = await execute("paper.nativeSync", {
    docId,
    writer: RICH_NATIVE_WRITER,
    ...sent,
    update: Buffer.from(sent.update).toString("base64"),
    stateVector: Buffer.from(sent.stateVector).toString("base64"),
  })
  const reply = nativeSyncOutputSchema.parse(result.output)
  expect(
    client.receive(sent, {
      ...reply,
      update: Buffer.from(reply.update, "base64"),
      stateVector: Buffer.from(reply.stateVector, "base64"),
    }).failed
  ).toBe(false)
  return reply
}

describe("rich canonical Paper database admission", () => {
  it.each(["cv", "letter"] as const)(
    "saves and reloads %s without flattening fields, tables, photos or presentation",
    async (kind) =>
      inDatabase(async () => {
        const { docId, document } = await seeded(kind),
          client = await richClient(docId, document)
        expect(client.document()).toEqual(document)
        textOf(element(fragment(client.ydoc), "cell-text")).insert(0, "Saved ")
        const expected = client.document()
        expect(expected).not.toEqual(document)
        await push(docId, client)
        expect(client.hasPending()).toBe(false)
        const { row, log } = await snapshot(docId)
        expect(row.crdtDocument).toEqual(expected)
        expect(row.contentVersion).toBe(2)
        expect(log).toHaveLength(1)
        const replayed = loadYDoc(
          row.crdtBase,
          log.map((item) => item.update)
        )
        expect(materializeStored(replayed)).toEqual({
          ok: true,
          document: expected,
        })
        const reloaded = await richClient(docId, document)
        expect(reloaded.document()).toEqual(expected)
        replayed.destroy()
        client.ydoc.destroy()
        reloaded.ydoc.destroy()
      })
  )

  it("refuses old writers, wrong identities and legacy callbacks without writes or activity", async () =>
    inDatabase(async () => {
      const { docId, document } = await seeded("letter"),
        before = await snapshot(docId)
      const client = await richClient(docId, document)
      const activityBefore = await getDb().select().from(activity)
      for (const writer of [
        undefined,
        NATIVE_WRITER,
        { ...RICH_NATIVE_WRITER, capabilities: [] },
      ])
        await expect(
          syncContent(owner, docId, { ...client.prepare(), writer })
        ).rejects.toThrow()
      await expect(
        syncContent(owner, docId, {
          ...client.prepare(),
          writer: RICH_NATIVE_WRITER,
          provenance: undefined,
        })
      ).rejects.toThrow()
      await expect(
        store.registry.read(
          "paper.get",
          { docId, writer: RICH_NATIVE_WRITER },
          store.actor
        )
      ).rejects.toThrow("rich Paper editor")
      expect(await snapshot(docId)).toEqual(before)
      expect(await getDb().select().from(activity)).toEqual(activityBefore)
      client.ydoc.destroy()
    }))

  it("rejects malformed rich updates atomically and accepts later valid typing", async () =>
    inDatabase(async () => {
      const { docId, document } = await seeded("letter"),
        client = await richClient(docId, document)
      const before = await snapshot(docId),
        prepared = client.prepare()
      const corrupted = loadYDoc(client.state(), [])
      corrupted.getMap("paper").set("richText", "shadow copy")
      await expect(
        syncContent(owner, docId, {
          ...prepared,
          writer: RICH_NATIVE_WRITER,
          basedOn: client.revision,
          update: Y.encodeStateAsUpdate(
            corrupted,
            Y.encodeStateVector(client.ydoc)
          ),
        })
      ).rejects.toThrow("metadata")
      expect(await snapshot(docId)).toEqual(before)
      textOf(element(fragment(client.ydoc), "intro")).insert(0, "Valid ")
      await push(docId, client)
      expect((await snapshot(docId)).row.crdtDocument).toEqual(
        client.document()
      )
      corrupted.destroy()
      client.ydoc.destroy()
    }))

  it("keeps a removed nested photo retained by the update and preserves compaction replay", async () =>
    inDatabase(async () => {
      const { docId, document, fileId } = await seeded("letter"),
        client = await richClient(docId, document)
      const photo = element(fragment(client.ydoc), "photo"),
        parent = photo.parent
      if (!(parent instanceof Y.XmlFragment))
        throw new Error("Missing photo parent")
      parent.delete(parent.toArray().indexOf(photo), 1)
      await push(docId, client)
      const first = await snapshot(docId)
      expect(first.log[0]?.releasedPhotoRefs).toEqual([fileId])
      const refs = await getDb().execute<{ source: string }>(
        sql`select source from opencv_app.photo_refs where file_id = ${fileId}::uuid`
      )
      expect(
        refs.rows.some((row) =>
          row.source.startsWith("paper_doc_updates.released:")
        )
      ).toBe(true)
      textOf(element(fragment(client.ydoc), "intro")).insert(0, "Later ")
      await push(docId, client)
      await getDb()
        .update(paperDocUpdates)
        .set({ createdAt: new Date(Date.now() - 40 * 86400000) })
        .where(
          and(eq(paperDocUpdates.paperId, docId), eq(paperDocUpdates.seq, 2))
        )
      const { crdtBase, crdtBaseSeq } = first.row
      if (!crdtBase || crdtBaseSeq === null)
        throw new Error("Missing compaction base")
      const folded = await transaction(() =>
        foldSettledLog(docId, {
          base: crdtBase,
          baseSeq: crdtBaseSeq,
        })
      )
      expect(folded?.baseSeq).toBe(2)
      const current = await snapshot(docId)
      const replayed = loadYDoc(
        current.row.crdtBase,
        current.log.map((item) => item.update)
      )
      expect(materializeStored(replayed)).toEqual({
        ok: true,
        document: client.document(),
      })
      const reloaded = await richClient(docId, document)
      expect(reloaded.document()).toEqual(client.document())
      replayed.destroy()
      client.ydoc.destroy()
      reloaded.ydoc.destroy()
    }))

  it("refuses an unowned nested photo and a cache that disagrees with the canonical bytes", async () =>
    inDatabase(async () => {
      const { docId, document } = await seeded("letter"),
        client = await richClient(docId, document)
      const before = await snapshot(docId)
      const bad = loadYDoc(client.state(), [])
      const photo = element(fragment(bad), "photo")
      const content = photo
        .toArray()
        .find(
          (node) =>
            node instanceof Y.XmlElement && node.nodeName === "paperPhoto"
        )
      if (!(content instanceof Y.XmlElement))
        throw new Error("Missing photo properties")
      content.setAttribute(
        "photo",
        JSON.stringify({
          ...JSON.parse(String(content.getAttribute("photo"))),
          source: "file:00000000-0000-4000-8000-000000000099",
        })
      )
      await expect(
        syncContent(owner, docId, {
          ...client.prepare(),
          writer: RICH_NATIVE_WRITER,
          basedOn: client.revision,
          update: Y.encodeStateAsUpdate(bad, Y.encodeStateVector(client.ydoc)),
        })
      ).rejects.toThrow()
      expect(await snapshot(docId)).toEqual(before)
      const wrong = richPaperDocumentSchema.parse(document)
      wrong.presentation.inline.bold = true
      await getDb()
        .update(paperDocs)
        .set({ crdtDocument: wrong })
        .where(eq(paperDocs.id, docId))
      await expect(
        syncContent(owner, docId, {
          ...client.prepare(),
          writer: RICH_NATIVE_WRITER,
        })
      ).rejects.toThrow("cache")
      expect((await snapshot(docId)).row.crdtDocument).toEqual(wrong)
      bad.destroy()
      client.ydoc.destroy()
    }))
})
