import { randomUUID } from "node:crypto"

import {
  coachActor,
  delegateActorSchema,
  personActor,
} from "@workspace/domain/kernel"
import { eq, sql } from "drizzle-orm"
import type { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import {
  activity,
  chats,
  coachUsage,
  files,
  idempotency,
  paperPackageCandidates,
  paperPackageHeads,
  paperPackageVersions,
  pendingActions,
  user,
} from "../db/schema.js"
import {
  openBackend,
  REAL,
  type Backend,
} from "../test/registry-formal-support.js"
import { prepareStoredWordPackage } from "./package-candidates.js"
import { paperRegistry } from "./paper-registry.test-support.js"
import { fixturePackage } from "./package-fixtures.js"
import * as packageRestore from "./package-restore.js"
import * as packageStore from "./package-store.js"

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
})
afterAll(async () => {
  await backend?.close()
})

function registry() {
  const value = paperRegistry()
  return value
}

async function seed(id = randomUUID()) {
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

async function document(owner: string) {
  const { stageWordPackage, publishWordPackage } = packageStore
  const bytes = fixturePackage(
    '<w:p xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" w14:paraId="12345678" w14:textId="12345678"><w:r><w:t>A useful original phrase</w:t></w:r></w:p>'
  )
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "CV.docx", kind: "cv" },
    bytes
  )
  const published = await publishWordPackage(owner, stage.stageId)
  const head = await headOf(published.docId)
  return { ...published, incarnation: head.incarnation, bytes }
}

async function editInput(
  owner: string,
  docId: string,
  before: string,
  after: string
) {
  const page = await packageStore.readWordPackage(owner, { docId })
  const target = page.regions.find((region) => region.kind === "editable")
  if (!target || target.kind !== "editable") throw new Error("Missing target")
  return {
    docId,
    basedOn: page.revision,
    edits: [
      { op: "replaceText" as const, targetId: target.targetId, before, after },
    ],
  }
}

async function headOf(docId: string) {
  const [head] = await getDb()
    .select()
    .from(paperPackageHeads)
    .where(eq(paperPackageHeads.docId, docId))
  if (!head) throw new Error("Missing head")
  return head
}

async function receipts(id: string) {
  const rows = await getDb()
    .select()
    .from(activity)
    .where(eq(activity.userId, id))
  const keys = await getDb()
    .select()
    .from(idempotency)
    .where(eq(idempotency.userId, id))
  return rows.length + keys.length
}

function pool() {
  return (backend.db as unknown as { $client: Pool }).$client
}

async function commitHead(
  docId: string,
  owner: string,
  incarnation: string,
  revision: string
) {
  const client = await pool().connect()
  try {
    await client.query(
      `update opencv_app.paper_package_heads
       set revision = $1::uuid
       where doc_id = $2::uuid and user_id = $3::text and incarnation = $4::uuid`,
      [revision, docId, owner, incarnation]
    )
  } finally {
    client.release()
  }
}

async function otherBlocked(pid: number) {
  const probe = await pool().connect()
  try {
    const locks = await probe.query(
      `select 1 from pg_locks waiter
       where waiter.pid <> $1 and not waiter.granted
         and waiter.locktype = 'transactionid' and waiter.mode = 'ShareLock'
         and exists (
           select 1 from pg_locks holder
           where holder.pid = $1 and holder.granted
             and holder.locktype = 'transactionid' and holder.mode = 'ExclusiveLock'
             and holder.transactionid = waiter.transactionid
         ) limit 1`,
      [pid]
    )
    return (locks.rowCount ?? 0) > 0
  } finally {
    probe.release()
  }
}

async function laterRevision(owner: string, docId: string) {
  const input = await editInput(owner, docId, "original", "later")
  const prepared = await prepareStoredWordPackage(owner, input)
  if (prepared.kind !== "prepared") throw new Error("Missing later candidate")
  const [row] = await getDb()
    .select()
    .from(paperPackageCandidates)
    .where(eq(paperPackageCandidates.id, prepared.candidate.id))
  if (!row) throw new Error("Missing later row")
  const [version] = await getDb()
    .select()
    .from(paperPackageVersions)
    .where(eq(paperPackageVersions.revision, row.forwardRevision))
  const [file] = await getDb()
    .select({ bytes: files.bytes })
    .from(files)
    .where(eq(files.id, version!.fileId))
  return { revision: row.forwardRevision, bytes: file!.bytes }
}

describe("Word saves keep the reviewed document", () => {
  it("an agent cannot write a Word edit", () =>
    run(async () => {
      const actor = delegateActorSchema.parse({
        type: "delegate",
        userId: "agent-user",
        connectionId: randomUUID(),
        name: "Agent",
        scopes: ["job.read"],
        resources: "jobs",
        reads: "allow",
        writes: "approval",
      })
      await expect(
        registry().execute({
          name: "paper.edit",
          input: {
            docId: randomUUID(),
            basedOn: randomUUID(),
            edits: [
              {
                op: "replaceText",
                targetId: `t_${"ab".repeat(32)}`,
                before: "original",
                after: "better",
              },
            ],
          },
          actor,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    }))

  it("a Coach proposal leaves the document unchanged", () =>
    run(async () => {
      const id = await seed()
      const chatId = randomUUID()
      const turnId = randomUUID()
      await getDb()
        .insert(chats)
        .values({ id: chatId, userId: id, title: "Review" })
      await getDb().insert(coachUsage).values({
        id: turnId,
        userId: id,
        chatId,
        plan: "free",
        mode: "free",
        provider: "fake",
        model: "fake",
      })
      const doc = await document(id)
      const input = await editInput(id, doc.docId, "original", "better")
      const result = await registry().execute({
        name: "paper.edit",
        input,
        actor: coachActor(id, chatId, turnId),
        idempotencyKey: randomUUID(),
      })
      expect(result.pending).toBe(true)
      expect((await headOf(doc.docId)).revision).toBe(doc.revision)
      expect(
        await getDb()
          .select()
          .from(pendingActions)
          .where(eq(pendingActions.userId, id))
      ).toHaveLength(1)
      expect(
        await getDb().select().from(activity).where(eq(activity.userId, id))
      ).toHaveLength(0)
      const same = await editInput(id, doc.docId, "original", "original")
      const unchanged = await registry().execute({
        name: "paper.edit",
        input: same,
        actor: coachActor(id, chatId, turnId),
        idempotencyKey: randomUUID(),
      })
      expect(unchanged.pending).toBe(true)
      expect((await headOf(doc.docId)).revision).toBe(doc.revision)
      expect(
        await getDb().select().from(activity).where(eq(activity.userId, id))
      ).toHaveLength(0)
    }))

  it("a person can undo a Word edit while the head is still that save", () =>
    run(async () => {
      const id = await seed()
      const doc = await document(id)
      const input = await editInput(id, doc.docId, "original", "better")
      const commands = registry()
      const saved = await commands.execute({
        name: "paper.edit",
        input,
        actor: personActor(id),
        idempotencyKey: randomUUID(),
      })
      const output = saved.output as {
        revision: string
        restore: { id: string; digest: string }
      }
      expect(output.revision).not.toBe(doc.revision)
      expect((await headOf(doc.docId)).revision).toBe(output.revision)
      await commands.undo(id, saved.activityId!)
      expect((await headOf(doc.docId)).revision).not.toBe(output.revision)
      expect(
        (
          await packageStore.exportWordPackage(
            id,
            doc.docId,
            (await headOf(doc.docId)).revision
          )
        ).bytes
      ).toEqual(doc.bytes)
    }))

  it.skipIf(!REAL)(
    "a head moved before the lock refuses the unchanged receipt",
    () =>
      run(async () => {
        const id = await seed()
        const doc = await document(id)
        const later = await laterRevision(id, doc.docId)
        const input = await editInput(id, doc.docId, "original", "original")
        const read = packageStore.readWordPackage
        const spy = vi
          .spyOn(packageStore, "readWordPackage")
          .mockImplementation(async (...args) => {
            const page = await read(...args)
            await commitHead(doc.docId, id, doc.incarnation, later.revision)
            return page
          })
        const key = randomUUID()
        try {
          await expect(
            registry().execute({
              name: "paper.edit",
              input,
              actor: personActor(id),
              idempotencyKey: key,
            })
          ).rejects.toThrow("Basis conflict")
          expect(await receipts(id)).toBe(0)
          expect((await headOf(doc.docId)).revision).toBe(later.revision)
          await expect(
            registry().execute({
              name: "paper.edit",
              input,
              actor: personActor(id),
              idempotencyKey: key,
            })
          ).rejects.toThrow()
          expect(await receipts(id)).toBe(0)
          expect(
            (
              await packageStore.exportWordPackage(
                id,
                doc.docId,
                later.revision
              )
            ).bytes
          ).toEqual(later.bytes)
        } finally {
          spy.mockRestore()
        }
      }),
    20_000
  )

  it.skipIf(!REAL)(
    "the publication lock blocks the other save until the unchanged receipt commits",
    () =>
      run(async () => {
        const id = await seed()
        const doc = await document(id)
        const later = await laterRevision(id, doc.docId)
        const input = await editInput(id, doc.docId, "original", "original")
        let other: Promise<void> | undefined
        const check = packageRestore.revalidateUnchangedPackage
        const spy = vi
          .spyOn(packageRestore, "revalidateUnchangedPackage")
          .mockImplementation(async (...args) => {
            const mine = await getDb().execute<{ pid: number }>(
              sql`select pg_backend_pid() as pid`
            )
            other = commitHead(doc.docId, id, doc.incarnation, later.revision)
            let waiting = false
            for (let attempt = 0; attempt < 40 && !waiting; attempt += 1) {
              waiting = await otherBlocked(Number(mine.rows[0]?.pid))
              if (!waiting)
                await new Promise((resolve) => setTimeout(resolve, 25))
            }
            expect(waiting).toBe(true)
            await check(...args)
          })
        const key = randomUUID()
        try {
          const saved = await registry().execute({
            name: "paper.edit",
            input,
            actor: personActor(id),
            idempotencyKey: key,
          })
          const output = saved.output as { revision: string }
          expect(output.revision).toBe(doc.revision)
          await other
          expect((await headOf(doc.docId)).revision).toBe(later.revision)
          const replay = await registry().execute({
            name: "paper.edit",
            input,
            actor: personActor(id),
            idempotencyKey: key,
          })
          expect((replay.output as { revision: string }).revision).toBe(
            doc.revision
          )
          expect(await receipts(id)).toBe(1)
          expect(
            (
              await packageStore.exportWordPackage(
                id,
                doc.docId,
                later.revision
              )
            ).bytes
          ).toEqual(later.bytes)
        } finally {
          spy.mockRestore()
        }
      }),
    20_000
  )

  it.skipIf(!REAL)(
    "restore changes zero rows when later typing commits after the read",
    () =>
      run(async () => {
        const id = await seed()
        const doc = await document(id)
        const commands = registry()
        const saved = await commands.execute({
          name: "paper.edit",
          input: await editInput(id, doc.docId, "original", "better"),
          actor: personActor(id),
          idempotencyKey: randomUUID(),
        })
        const before = await getDb().select().from(paperPackageVersions)
        const restore = packageRestore.compareAndRestorePackage
        const spy = vi
          .spyOn(packageRestore, "compareAndRestorePackage")
          .mockImplementation(async (...args) => {
            await commitHead(doc.docId, id, doc.incarnation, doc.revision)
            return restore(...args)
          })
        try {
          await expect(commands.undo(id, saved.activityId!)).rejects.toThrow(
            "This page changed after that save, so Undo was skipped."
          )
          expect((await headOf(doc.docId)).revision).toBe(doc.revision)
          expect(await getDb().select().from(paperPackageVersions)).toEqual(
            before
          )
          expect(
            (await packageStore.exportWordPackage(id, doc.docId, doc.revision))
              .bytes
          ).toEqual(doc.bytes)
          expect(
            (
              await getDb()
                .select({ undoneAt: activity.undoneAt })
                .from(activity)
                .where(eq(activity.id, saved.activityId!))
            )[0]?.undoneAt
          ).toBeNull()
        } finally {
          spy.mockRestore()
        }
      }),
    20_000
  )
})
