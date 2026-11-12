import { randomUUID } from "node:crypto"

import { coachActor, personActor } from "@workspace/domain"
import { eq } from "drizzle-orm"
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
import { bindCatalog } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import {
  openBackend,
  REAL,
  type Backend,
} from "../test/registry-formal-support.js"
import { prepareStoredWordPackage } from "./package-candidates.js"
import * as packageCandidates from "./package-candidates.js"
import { registerPaper } from "./commands.js"
import { fixturePackage } from "./package-fixtures.js"
import * as packageRestore from "./package-restore.js"
import * as packageStore from "./package-store.js"
import { implementation as readWord } from "./operations/read/server.js"

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
})
afterAll(async () => {
  await backend?.close()
})

function registry() {
  const value = new Registry()
  registerPaper(value)
  bindCatalog(value, { "paper.read": readWord })
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

function onPreparedExecute(effect: () => Promise<void> | void) {
  let calls = 0
  const execute = Registry.prototype.execute
  const spy = vi
    .spyOn(Registry.prototype, "execute")
    .mockImplementation(async function (this: Registry, options) {
      calls += 1
      if (calls === 2) await effect()
      return execute.call(this, options)
    })
  return { calls: () => calls, stop: () => spy.mockRestore() }
}

async function pendingOf(owner: string) {
  const [row] = await getDb()
    .select()
    .from(pendingActions)
    .where(eq(pendingActions.userId, owner))
  if (!row) throw new Error("Missing proposal")
  return row
}

async function coachProposal(owner: string, before: string, after: string) {
  const chatId = randomUUID()
  const turnId = randomUUID()
  await getDb()
    .insert(chats)
    .values({ id: chatId, userId: owner, title: "Review" })
  await getDb().insert(coachUsage).values({
    id: turnId,
    userId: owner,
    chatId,
    plan: "free",
    mode: "free",
    provider: "fake",
    model: "fake",
  })
  const doc = await document(owner)
  const result = await registry().execute({
    name: "paper.edit",
    input: await editInput(owner, doc.docId, before, after),
    actor: coachActor(owner, chatId, turnId),
    idempotencyKey: randomUUID(),
  })
  expect(result.pending).toBe(true)
  return { doc, proposal: await pendingOf(owner) }
}

async function stillWaiting(owner: string, docId: string, revision: string) {
  expect((await pendingOf(owner)).status).toBe("pending")
  const rows = await getDb()
    .select()
    .from(activity)
    .where(eq(activity.userId, owner))
  expect(rows).toHaveLength(0)
  expect((await headOf(docId)).revision).toBe(revision)
}

async function approveAfterMove(owner: string, before: string, after: string) {
  const { doc, proposal } = await coachProposal(owner, before, after)
  const later = await laterRevision(owner, doc.docId)
  expect((await headOf(doc.docId)).revision).toBe(doc.revision)
  await commitHead(doc.docId, owner, doc.incarnation, later.revision)
  await expect(registry().approve(owner, proposal.id)).rejects.toThrow(
    "Basis conflict"
  )
  await stillWaiting(owner, doc.docId, later.revision)
  expect(
    (await packageStore.exportWordPackage(owner, doc.docId, later.revision))
      .bytes
  ).toEqual(later.bytes)
}

describe("Word save rechecks", () => {
  it.skipIf(!REAL)(
    "a real edit refuses when the head moves after prepare and before the lock",
    () =>
      run(async () => {
        const id = await seed()
        const doc = await document(id)
        const later = await laterRevision(id, doc.docId)
        const input = await editInput(id, doc.docId, "original", "better")
        const gate = onPreparedExecute(async () => {
          expect((await headOf(doc.docId)).revision).toBe(doc.revision)
          await commitHead(doc.docId, id, doc.incarnation, later.revision)
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
          expect(gate.calls()).toBe(2)
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
          gate.stop()
        }
      }),
    20_000
  )

  it.skipIf(!REAL)(
    "a Coach edit approved after the head moves refuses",
    () => run(async () => approveAfterMove(await seed(), "original", "better")),
    20_000
  )

  it.skipIf(!REAL)(
    "a Coach no-op approved after the head moves refuses",
    () =>
      run(async () => approveAfterMove(await seed(), "original", "original")),
    20_000
  )
})
