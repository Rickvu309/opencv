import { randomUUID } from "node:crypto"

import { and, eq, sql } from "drizzle-orm"
import type { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  activity,
  chats,
  paperPackageCandidates,
  paperPackageHeads,
  pendingActions,
  user,
} from "../db/schema.js"
import {
  openBackend,
  REAL,
  type Backend,
} from "../test/registry-formal-support.js"
import {
  prepareStoredWordPackage,
  restoreWordCandidate,
} from "./package-candidates.js"
import { fixturePackage } from "./package-fixtures.js"
import * as packageRestore from "./package-restore.js"
import {
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./package-store.js"

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)
const chatFor = new Map<string, string>()

beforeAll(async () => {
  backend = await openBackend()
})
afterAll(async () => backend?.close())

async function account() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

async function document(owner: string) {
  const bytes = fixturePackage(
    '<w:p xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" w14:paraId="12345678" w14:textId="12345678"><w:r><w:t>A useful original phrase</w:t></w:r></w:p>'
  )
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "CV.docx", kind: "cv" },
    bytes
  )
  const head = await publishWordPackage(owner, stage.stageId)
  return { head, bytes }
}

async function proposal(
  owner: string,
  id: string,
  status: "pending" | "denied" | "expired"
) {
  let chatId = chatFor.get(owner)
  if (!chatId) {
    chatId = randomUUID()
    chatFor.set(owner, chatId)
    await getDb().insert(chats).values({
      id: chatId,
      userId: owner,
      title: "Review",
    })
  }
  await getDb()
    .insert(pendingActions)
    .values({
      id: randomUUID(),
      userId: owner,
      chatId,
      command: "paper.edit",
      input: {},
      summary: "Review",
      status,
      frozenReview: { candidate: { id } },
    })
}

async function prepare(
  owner: string,
  docId: string,
  after: string,
  anchor: boolean
) {
  const page = await readWordPackage(owner, { docId })
  const target = page.regions.find((region) => region.kind === "editable")
  if (!target || target.kind !== "editable")
    throw new Error("Missing fixture target")
  const input = {
    docId,
    basedOn: page.revision,
    edits: [
      {
        op: "replaceText",
        targetId: target.targetId,
        before: "original",
        after,
      },
    ],
  }
  const prepared = await prepareStoredWordPackage(owner, input)
  if (prepared.kind !== "prepared") throw new Error("Missing fixture candidate")
  if (anchor) await proposal(owner, prepared.candidate.id, "pending")
  const [row] = await getDb()
    .select()
    .from(paperPackageCandidates)
    .where(eq(paperPackageCandidates.id, prepared.candidate.id))
  if (!row) throw new Error("Missing candidate record")
  return { prepared, row }
}

async function copies(
  row: Awaited<ReturnType<typeof prepare>>["row"],
  count: number,
  status: "pending" | "denied" | "expired" | null
) {
  const ids = Array.from({ length: count }, () => randomUUID())
  const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await getDb()
    .insert(paperPackageCandidates)
    .values(ids.map((id) => ({ ...row, id, createdAt })))
  if (status) for (const id of ids) await proposal(row.userId, id, status)
  return ids
}

async function receipt(
  owner: string,
  docId: string,
  id: string,
  undone: boolean
) {
  await getDb()
    .insert(activity)
    .values({
      id: randomUUID(),
      userId: owner,
      actor: "person",
      command: "paper.edit",
      subjectKind: "paper",
      subjectId: docId,
      summary: "Saved",
      result: { restore: { id } },
      reversalInput: { candidate: { id } },
      undoneAt: undone ? new Date() : null,
    })
}

async function candidateIds(owner: string) {
  const rows = await getDb()
    .select({ id: paperPackageCandidates.id })
    .from(paperPackageCandidates)
    .where(eq(paperPackageCandidates.userId, owner))
  return rows.map((row) => row.id)
}

function pool() {
  return (backend.db as unknown as { $client: Pool }).$client
}

async function otherBlocked(pid: number) {
  const probe = await pool().connect()
  try {
    const locks = await probe.query(
      `select 1 from pg_locks waiter
       where waiter.pid <> $1 and not waiter.granted
         and (
           exists (
             select 1 from pg_locks holder
             where holder.pid = $1 and holder.granted
               and holder.locktype = 'tuple' and waiter.locktype = 'tuple'
               and waiter.relation = holder.relation
           )
           or exists (
             select 1 from pg_locks holder
             where holder.pid = $1 and holder.granted
               and holder.locktype = 'transactionid'
               and holder.mode = 'ExclusiveLock'
               and waiter.locktype = 'transactionid'
               and waiter.mode = 'ShareLock'
               and holder.transactionid = waiter.transactionid
           )
         )
       limit 1`,
      [pid]
    )
    return (locks.rowCount ?? 0) > 0
  } finally {
    probe.release()
  }
}

describe("unreachable Word candidate removal", () => {
  it("a full account can save once unreachable copies are gone", () =>
    run(async () => {
      const owner = await account()
      const doc = await document(owner)
      const saved = await prepare(owner, doc.head.docId, "better", true)
      const kept = [saved.row.id, ...(await copies(saved.row, 62, "pending"))]
      const [denied] = await copies(saved.row, 1, "denied")
      const [expired] = await copies(saved.row, 1, "expired")
      const [superseded] = await copies(saved.row, 1, null)
      if (!denied || !expired || !superseded)
        throw new Error("Missing unreachable copy")
      await receipt(owner, doc.head.docId, superseded, false)
      const stranger = await account()
      const strangerDoc = await document(stranger)
      const stray = await prepare(
        stranger,
        strangerDoc.head.docId,
        "other",
        false
      )
      const other = await document(owner)
      const added = await prepare(owner, other.head.docId, "next", true)
      const ids = await candidateIds(owner)
      expect(ids).toHaveLength(64)
      expect(kept.every((id) => ids.includes(id))).toBe(true)
      expect(ids).toContain(added.prepared.candidate.id)
      expect(ids).not.toContain(denied)
      expect(ids).not.toContain(expired)
      expect(ids).not.toContain(superseded)
      expect(await candidateIds(stranger)).toEqual([stray.row.id])
      expect(
        (await readWordPackage(owner, { docId: doc.head.docId })).revision
      ).toBe(doc.head.revision)
    }))

  it("a live Undo stays when the document is still that save", () =>
    run(async () => {
      const owner = await account()
      const doc = await document(owner)
      const saved = await prepare(owner, doc.head.docId, "better", false)
      await getDb()
        .update(paperPackageHeads)
        .set({ revision: saved.row.forwardRevision })
        .where(
          and(
            eq(paperPackageHeads.userId, saved.row.userId),
            eq(paperPackageHeads.docId, saved.row.docId),
            eq(paperPackageHeads.incarnation, saved.row.incarnation)
          )
        )
      await receipt(owner, doc.head.docId, saved.row.id, false)
      const [orphan] = await copies(saved.row, 1, null)
      const [undone] = await copies(saved.row, 1, null)
      if (!orphan || !undone) throw new Error("Missing live-undo copy")
      await receipt(owner, doc.head.docId, undone, true)
      const other = await document(owner)
      const added = await prepare(owner, other.head.docId, "next", true)
      const ids = await candidateIds(owner)
      expect(ids).toContain(saved.row.id)
      expect(ids).toContain(added.prepared.candidate.id)
      expect(ids).not.toContain(orphan)
      expect(ids).not.toContain(undone)
      expect(ids).toHaveLength(2)
    }))

  it.skipIf(!REAL)(
    "removal waits while Undo holds the saved copy",
    () =>
      run(async () => {
        const owner = await account()
        const doc = await document(owner)
        const saved = await prepare(owner, doc.head.docId, "better", true)
        const [orphan] = await copies(saved.row, 1, null)
        if (!orphan) throw new Error("Missing held-copy orphan")
        const other = await document(owner)
        const read = packageRestore.readPackageHead
        let pid = 0
        let release = () => {}
        const hold = new Promise<void>((resolve) => {
          release = resolve
        })
        let markEntered = () => {}
        const entered = new Promise<void>((resolve) => {
          markEntered = resolve
        })
        const spy = vi
          .spyOn(packageRestore, "readPackageHead")
          .mockImplementation(async (...args) => {
            const mine = await getDb().execute<{ pid: number }>(
              sql`select pg_backend_pid() as pid`
            )
            pid = Number(mine.rows[0]?.pid)
            markEntered()
            await hold
            return read(...args)
          })
        const held = transaction(() =>
          restoreWordCandidate(
            owner,
            saved.prepared.candidate,
            saved.row.forwardRevision
          )
        ).catch((error: unknown) =>
          error instanceof Error ? error : new Error("Undo failed")
        )
        let saving: Promise<Awaited<ReturnType<typeof prepare>> | Error> =
          Promise.resolve(new Error("Save has not started"))
        try {
          const opened = await Promise.race([
            entered.then(() => "entered" as const),
            held.then(() => "finished" as const),
          ])
          if (opened !== "entered" || !pid)
            throw new Error("Undo finished before it held the copy")
          saving = prepare(owner, other.head.docId, "next", true).catch(
            (error: unknown) =>
              error instanceof Error ? error : new Error("Save failed")
          )
          let waiting = false
          for (let attempt = 0; attempt < 80 && !waiting; attempt += 1) {
            waiting = await otherBlocked(pid)
            if (!waiting)
              await new Promise((resolve) => setTimeout(resolve, 25))
          }
          expect(waiting).toBe(true)
          release()
          const restored = await held
          expect(restored).toBeInstanceOf(Error)
          const stored = await saving
          if (stored instanceof Error) throw stored
          const ids = await candidateIds(owner)
          expect(ids).toContain(saved.row.id)
          expect(ids).toContain(stored.prepared.candidate.id)
          expect(ids).not.toContain(orphan)
          expect(
            (await readWordPackage(owner, { docId: doc.head.docId })).revision
          ).toBe(doc.head.revision)
        } finally {
          release()
          await held.catch(() => undefined)
          spy.mockRestore()
          await saving
        }
      }),
    20_000
  )
})
