import { loadYDoc, updateSince } from "@workspace/paper-crdt"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { paperDocUpdates, paperDocs } from "../db/schema.js"
import { openCoachStore, type CoachStore } from "../test/paper-coach.js"
import { withText } from "../test/paper-content.js"
import {
  COACH_UNDO_WINDOW_MS,
  compactionHorizon,
  FORK_WINDOW_MS,
  foldSettledLog,
} from "./content-compact.js"

const userId = "user-compact-window"
const DAY = 24 * 60 * 60 * 1000

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

function stamp(
  seq: number,
  origin: string,
  ageMs: number,
  editId: string | null = null
) {
  return {
    seq,
    origin,
    editId,
    createdAt: new Date(Date.now() - ageMs),
  }
}

async function pad(docId: string, from: number, to: number, at: Date) {
  await h.store.db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`)
    await tx.execute(sql`
      insert into opencv_app.paper_doc_updates
        (paper_id, seq, origin, update, created_at, released_photo_refs)
      select ${docId}::uuid,
        g.seq,
        'person',
        ${quietBytes},
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

describe("compaction horizon", () => {
  it("lets an empty side leave the horizon to the other", () => {
    const now = new Date()
    const recent = stamp(8, "person", 5 * 60 * 1000)
    const coach = stamp(4, "coach", FORK_WINDOW_MS + 1000, "edit-1")
    const laterCoach = stamp(9, "coach", 1000, "edit-2")
    const earlier = stamp(3, "person", 1000)
    expect(compactionHorizon([recent], now)).toBe(8)
    expect(compactionHorizon([coach], now)).toBe(4)
    expect(compactionHorizon([coach, recent], now)).toBe(4)
    expect(compactionHorizon([laterCoach, earlier], now)).toBe(3)
    expect(compactionHorizon([], now)).toBeNull()
    expect(
      compactionHorizon([stamp(2, "person", COACH_UNDO_WINDOW_MS + DAY)], now)
    ).toBeNull()
  })

  it("does not let a reverted Coach edit hold the horizon", () => {
    const now = new Date()
    const coach = stamp(4, "coach", FORK_WINDOW_MS + 1000, "edit-1")
    const revert = stamp(5, "revert", FORK_WINDOW_MS + 1000, "edit-1")
    const recent = stamp(9, "person", 1000)
    expect(compactionHorizon([coach, revert], now)).toBeNull()
    expect(compactionHorizon([coach, revert, recent], now)).toBe(9)
  })
})

describe("paper log windows", () => {
  it("refuses undo once a Coach edit is folded out of the 30-day window", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      const edited = await h.coach(docId, 1, [
        { op: "setText", blockId: "t1", text: "First paragraph. Old coach" },
      ])
      await h.store.db
        .update(paperDocUpdates)
        .set({ createdAt: oldEnough() })
        .where(eq(paperDocUpdates.paperId, docId))
      await pad(docId, 3, 63, new Date())
      await h.person(docId, client, (paper) =>
        withText(paper, "t2", "Second paragraph. Kept")
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
      expect(row.crdtBaseSeq).toBe(2)
      expect(row.crdtEpoch).toBe(1)
      expect(seqs).not.toContain(2)
      expect(Math.min(...seqs)).toBe(3)
      await expect(
        h.store.registry.undo(userId, edited.activityId!)
      ).rejects.toThrow("This edit is no longer in the document's history")
    })
  })

  it("folds nothing when every row is outside both windows", async () => {
    await h.inDatabase(async () => {
      const { docId, client } = await h.created()
      await h.person(docId, client, (paper) =>
        withText(paper, "t2", "Second paragraph. Old")
      )
      await h.store.db
        .update(paperDocUpdates)
        .set({ createdAt: oldEnough() })
        .where(eq(paperDocUpdates.paperId, docId))
      const row = (
        await h.store.db.select().from(paperDocs).where(eq(paperDocs.id, docId))
      )[0]!
      const folded = await foldSettledLog(docId, {
        base: row.crdtBase!,
        baseSeq: row.crdtBaseSeq!,
      })
      expect(folded).toBeNull()
      expect(
        (
          await h.store.db
            .select({ seq: paperDocUpdates.seq })
            .from(paperDocUpdates)
            .where(eq(paperDocUpdates.paperId, docId))
        ).length
      ).toBe(1)
      expect(
        (
          await h.store.db
            .select({ seq: paperDocs.crdtBaseSeq })
            .from(paperDocs)
            .where(eq(paperDocs.id, docId))
        )[0]?.seq
      ).toBe(1)
    })
  })
})
