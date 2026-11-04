import {
  absorbUpdate,
  loadYDoc,
  materialize,
  stateVectorOf,
  updateSince,
} from "@workspace/paper-crdt"
import { and, eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { paperDocUpdates, paperDocs } from "../db/schema.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import {
  bytesOf,
  clientFrom,
  encoded,
  typed,
  withText,
} from "../test/paper-content.js"
import { NEWER_FIRST } from "./undo-rules.js"

const userId = "user-compact-1070"
const DAY = 24 * 60 * 60 * 1000

type SyncBody = {
  update: string
  revision: number
  reset: boolean
  stale: boolean
}

const quietDoc = loadYDoc(null, [])
const quietUpdate = updateSince(quietDoc, new Uint8Array())
quietDoc.destroy()
if (!quietUpdate) throw new Error("missing quiet update")
const quietBytes = Buffer.from(quietUpdate)

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

function readDoc(doc: Parameters<typeof materialize>[0]) {
  const read = materialize(doc)
  if (!read.ok) throw new Error(read.reason)
  return read.document
}

async function sync(
  docId: string,
  update: string,
  epoch: number,
  stateVector = "",
  basedOn?: number
) {
  const result = await h.run("paper.sync", {
    docId,
    epoch,
    update,
    stateVector,
    basedOn,
  })
  return result.output as SyncBody
}

async function docRow(docId: string) {
  const row = (
    await h.store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
  )[0]
  if (!row) throw new Error("missing paper")
  return row
}

async function pad(
  docId: string,
  from: number,
  to: number,
  update: Buffer,
  at: Date
) {
  await h.store.db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`)
    await tx.execute(sql`
      insert into opencv_app.paper_doc_updates
        (paper_id, seq, origin, update, created_at, released_photo_refs)
      select ${docId}::uuid,
        g.seq,
        'person',
        ${update},
        ${at},
        ARRAY[]::uuid[]
      from generate_series(${from}::int, ${to}::int) as g(seq)
    `)
    await tx
      .update(paperDocs)
      .set({ contentVersion: to })
      .where(eq(paperDocs.id, docId))
  })
}

describe("paper log compaction", () => {
  it("folds rows outside both windows on the 64th change and keeps a recent Coach edit", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      const seedFull = updateSince(client, new Uint8Array())
      if (!seedFull) throw new Error("missing seed")
      const seedState = encoded(seedFull)
      const seedVector = encoded(stateVectorOf(client))
      await h.person(docId, client, (paper) =>
        withText(paper, "t2", "Second paragraph. Ancient")
      )
      await h.store.db
        .update(paperDocUpdates)
        .set({ createdAt: oldEnough() })
        .where(
          and(eq(paperDocUpdates.paperId, docId), eq(paperDocUpdates.seq, 2))
        )
      await pad(docId, 3, 490, quietBytes, oldEnough())
      const coach = await h.coach(docId, 490, [
        { op: "setText", blockId: "t1", text: "First paragraph. Coach adds" },
      ])
      expect(coach.output.revision).toBe(491)
      const coachId = coach.output.editId
      expect(coachId).toEqual(expect.any(String))
      await h.person(docId, client, (paper) =>
        withText(paper, "t2", "Second paragraph. Ancient 0")
      )
      expect((await docRow(docId)).contentVersion).toBe(492)
      const caught = await sync(docId, "", 0)
      const other = clientFrom(caught.update)
      const otherVector = encoded(stateVectorOf(other))
      await pad(docId, 493, 511, quietBytes, new Date())
      expect(await h.rowCount(docId)).toBe(510)
      await h.person(docId, client, (paper) =>
        withText(paper, "t2", "Second paragraph. Later")
      )
      const warm = readDoc(client)
      const stored = await h.paperOf(docId)
      const row = await docRow(docId)
      const logged = await h.store.db
        .select({
          seq: paperDocUpdates.seq,
          editId: paperDocUpdates.editId,
        })
        .from(paperDocUpdates)
        .where(eq(paperDocUpdates.paperId, docId))
      expect(row.crdtEpoch).toBe(1)
      expect(row.crdtBaseSeq).toBe(490)
      expect(row.contentVersion).toBe(512)
      expect(Math.min(...logged.map((item) => item.seq))).toBe(491)
      expect(logged.some((item) => item.seq < 491)).toBe(false)
      expect(logged.some((item) => item.editId === coachId)).toBe(true)
      expect(stored).toEqual(warm)
      await h.dropCache(docId)
      const cold = await sync(docId, "", 0)
      expect(cold.reset).toBe(false)
      const rebuilt = readDoc(clientFrom(cold.update))
      expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(warm))
      expect(stored).toEqual(rebuilt)
      const behind = await sync(docId, "", 1, seedVector)
      expect(behind.reset).toBe(false)
      expect(behind.stale).toBe(false)
      const behindDoc = clientFrom(seedState)
      const behindAbsorbed = absorbUpdate(
        behindDoc,
        bytesOf(behind.update),
        "log"
      )
      if (!behindAbsorbed.ok) throw new Error(behindAbsorbed.reason)
      expect(JSON.stringify(readDoc(behindDoc))).toBe(JSON.stringify(warm))
      const cloneFull = updateSince(other, new Uint8Array())
      if (!cloneFull) throw new Error("missing clone")
      const clone = clientFrom(encoded(cloneFull))
      const stale = await sync(
        docId,
        typed(clone, (paper) =>
          withText(paper, "t2", "Second paragraph. Stale")
        ),
        1,
        "",
        492
      )
      expect(stale.reset).toBe(false)
      expect(stale.stale).toBe(true)
      expect((await docRow(docId)).contentVersion).toBe(512)
      const followed = await sync(docId, "", 1, otherVector)
      expect(followed.reset).toBe(false)
      expect(followed.stale).toBe(false)
      const followedAbsorbed = absorbUpdate(
        other,
        bytesOf(followed.update),
        "log"
      )
      if (!followedAbsorbed.ok) throw new Error(followedAbsorbed.reason)
      const merged = await sync(
        docId,
        typed(other, (paper) =>
          withText(paper, "t2", "Second paragraph. From the other tab")
        ),
        1,
        "",
        followed.revision
      )
      expect(merged.stale).toBe(false)
      expect(merged.reset).toBe(false)
      expect(await h.textOf(docId, "t2")).toBe(
        "Second paragraph. From the other tab"
      )
      const newer = await h.coach(docId, merged.revision, [
        {
          op: "setText",
          blockId: "t1",
          text: "First paragraph. Coach adds more",
        },
      ])
      await expect(
        h.store.registry.undo(userId, coach.activityId!)
      ).rejects.toThrow(NEWER_FIRST)
      await h.store.registry.undo(userId, newer.activityId!)
      await h.store.registry.undo(userId, coach.activityId!)
      expect(await h.textOf(docId, "t1")).toBe("First paragraph.")
      expect(await h.textOf(docId, "t2")).toBe(
        "Second paragraph. From the other tab"
      )
      const baseSeq = (await docRow(docId)).crdtBaseSeq
      expect(baseSeq).toBe(490)
      await expect(
        h.coach(docId, baseSeq! - 1, [
          { op: "setText", blockId: "t2", text: "Second paragraph. Too old" },
        ])
      ).rejects.toThrow(/older than this document's history/)
      await h.coach(docId, baseSeq!, [
        {
          op: "setText",
          blockId: "t2",
          text: "Second paragraph. Still in history",
        },
      ])
    })
  })
})
