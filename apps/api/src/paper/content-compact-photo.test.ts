import {
  paperPhotoRef,
  parsePaperId,
  parseUserId,
  type PaperDocument,
} from "@workspace/domain"
import { and, eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { files, paperDocUpdates, paperDocs } from "../db/schema.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { withText } from "../test/paper-content.js"
import { withContent } from "./content-store.js"
import { png } from "./photo.fixtures.js"
import { sweepUnattachedPhotos } from "./photo-sweep.js"
import { saveFile } from "./store.js"

const userId = "user-compact-photo"
const DAY = 24 * 60 * 60 * 1000
const clearEditId = "clear-photo"

let h: CoachStore

beforeAll(async () => {
  h = await openCoachStore(userId)
})

afterAll(async () => {
  await h.store.client.close()
})

function oldEnough() {
  return new Date(Date.now() - 40 * DAY)
}

function withPhoto(paper: PaperDocument, ref: string): PaperDocument {
  if (paper.kind !== "cv") return paper
  return { ...paper, header: { ...paper.header, photo: ref } }
}

function withoutPhoto(paper: PaperDocument): PaperDocument {
  if (paper.kind !== "cv") return paper
  const { photo: _removed, ...header } = paper.header
  void _removed
  return { ...paper, header }
}

async function sourcesOf(fileId: string) {
  const refs = await h.store.db.execute<{ source: string }>(sql`
    select source from opencv_app.photo_refs where file_id = ${fileId}::uuid
  `)
  return refs.rows.map((row) => row.source)
}

async function agedPhoto() {
  const saved = await saveFile({
    userId: parseUserId(userId),
    name: "face.png",
    mediaType: "image/png",
    bytes: Buffer.from(png),
    purpose: "avatar",
  })
  await h.store.db
    .update(files)
    .set({ createdAt: new Date(Date.now() - 2 * DAY) })
    .where(eq(files.id, saved.id))
  return saved
}

async function paperWithPhoto(fileId: string) {
  const { docId } = await h.created()
  await withContent(
    parseUserId(userId),
    parsePaperId(docId),
    async (content) => {
      await content.edit({
        origin: "server",
        target: withPhoto(content.document, paperPhotoRef(fileId)),
      })
      await content.edit({
        origin: "coach",
        editId: clearEditId,
        target: withoutPhoto(content.document),
      })
    }
  )
  return docId
}

async function updateAt(docId: string, seq: number) {
  const row = (
    await h.store.db
      .select({ update: paperDocUpdates.update })
      .from(paperDocUpdates)
      .where(
        and(eq(paperDocUpdates.paperId, docId), eq(paperDocUpdates.seq, seq))
      )
  )[0]
  if (!row) throw new Error(`missing update ${seq}`)
  return row.update
}

describe("a photo released by a Coach edit", () => {
  it("stays through the daily sweep and comes back when that edit is undone", async () => {
    await h.inDatabase(async () => {
      const saved = await agedPhoto()
      const docId = await paperWithPhoto(saved.id)
      const sources = await sourcesOf(saved.id)
      expect(
        sources.some((source) =>
          source.startsWith("paper_doc_updates.released:")
        )
      ).toBe(true)
      expect(await sweepUnattachedPhotos()).not.toContain(saved.id)
      await h.run("paper.revertEdit", { docId, editId: clearEditId })
      expect((await h.paperOf(docId)).header.photo).toBe(
        paperPhotoRef(saved.id)
      )
      expect(await sweepUnattachedPhotos()).not.toContain(saved.id)
    })
  })

  it("can be deleted once that release row is folded", async () => {
    await h.inDatabase(async () => {
      const saved = await agedPhoto()
      const docId = await paperWithPhoto(saved.id)
      expect(await sweepUnattachedPhotos()).not.toContain(saved.id)
      await h.store.db
        .update(paperDocUpdates)
        .set({ createdAt: oldEnough() })
        .where(eq(paperDocUpdates.paperId, docId))
      const released = await updateAt(docId, 3)
      const copies = []
      for (let seq = 4; seq <= 63; seq += 1) {
        copies.push({
          paperId: docId,
          seq,
          origin: "person",
          update: released,
          createdAt: new Date(),
          releasedPhotoRefs: [] as string[],
        })
      }
      await h.store.db.insert(paperDocUpdates).values(copies)
      await h.store.db
        .update(paperDocs)
        .set({ contentVersion: 63 })
        .where(eq(paperDocs.id, docId))
      await withContent(
        parseUserId(userId),
        parsePaperId(docId),
        async (content) => {
          await content.edit({
            origin: "person",
            target: withText(
              content.document,
              "t2",
              "Second paragraph. After the fold"
            ),
          })
        }
      )
      const row = (
        await h.store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
      )[0]!
      const seqs = (
        await h.store.db
          .select({ seq: paperDocUpdates.seq })
          .from(paperDocUpdates)
          .where(eq(paperDocUpdates.paperId, docId))
      ).map((item) => item.seq)
      expect(row.contentVersion).toBe(64)
      expect(row.crdtBaseSeq).toBe(3)
      expect(seqs).not.toContain(3)
      expect((await h.paperOf(docId)).header.photo).toBeUndefined()
      expect(await sourcesOf(saved.id)).toEqual([])
      expect(await sweepUnattachedPhotos()).toContain(saved.id)
    })
  })
})
