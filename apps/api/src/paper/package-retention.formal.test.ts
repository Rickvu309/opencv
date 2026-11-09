import { randomUUID } from "node:crypto"

import { count, eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { getDb, transaction, withDatabase } from "../db/context.js"
import {
  files,
  paperPackageCandidates,
  paperPackageVersions,
  user,
} from "../db/schema.js"
import {
  openBackend,
  REAL,
  type Backend,
} from "../test/registry-formal-support.js"
import {
  commitWordCandidate,
  prepareStoredWordPackage,
  restoreWordCandidate,
} from "./package-candidates.js"
import { fixturePackage } from "./package-fixtures.js"
import * as packageStore from "./package-store.js"
import {
  exportWordPackage,
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./package-store.js"

let backend: Backend
const owner = randomUUID()
const stranger = randomUUID()
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
  await backend.db.insert(user).values(
    [owner, stranger].map((id) => ({
      id,
      name: id,
      email: `${id}@test.invalid`,
    }))
  )
})
afterAll(async () => backend?.close())

async function document(account = owner) {
  const bytes = fixturePackage(
    '<w:p xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" w14:paraId="12345678" w14:textId="12345678"><w:r><w:t>A useful original phrase</w:t></w:r></w:p>'
  )
  const stage = await stageWordPackage(
    account,
    { requestId: randomUUID(), name: "CV.docx", kind: "cv" },
    bytes
  )
  const head = await publishWordPackage(account, stage.stageId)
  return { head, bytes }
}

async function prepare(
  docId: string,
  before = "original",
  after = "better",
  account = owner
) {
  const page = await readWordPackage(account, { docId })
  const target = page.regions.find((region) => region.kind === "editable")
  if (!target || target.kind !== "editable")
    throw new Error("Missing fixture target")
  const input = {
    docId,
    basedOn: page.revision,
    edits: [{ op: "replaceText", targetId: target.targetId, before, after }],
  }
  const prepared = await prepareStoredWordPackage(account, input)
  if (prepared.kind !== "prepared") throw new Error("Missing fixture candidate")
  return { input, prepared }
}

async function record(candidate: { id: string }) {
  const [row] = await getDb()
    .select()
    .from(paperPackageCandidates)
    .where(eq(paperPackageCandidates.id, candidate.id))
  if (!row) throw new Error("Missing candidate record")
  return row
}

async function retentionFixture(copies: number) {
  const account = randomUUID()
  await getDb()
    .insert(user)
    .values({
      id: account,
      name: account,
      email: `${account}@test.invalid`,
    })
  const doc = await document(account)
  const retained = await prepare(doc.head.docId, "original", "better", account)
  const row = await record(retained.prepared.candidate)
  if (copies > 1)
    await getDb()
      .insert(paperPackageCandidates)
      .values(
        Array.from({ length: copies - 1 }, () => ({ ...row, id: randomUUID() }))
      )
  return { account, doc, ...retained, row }
}

async function retainedCounts(account: string) {
  return Promise.all(
    [files, paperPackageVersions, paperPackageCandidates].map((table) =>
      getDb()
        .select({ count: count() })
        .from(table)
        .where(eq(table.userId, account))
    )
  )
}

describe("private Word candidate retention", () => {
  it("refuses candidate count pressure without deleting a saved review or clean Undo", () =>
    run(async () => {
      const fixture = await retentionFixture(63)
      const other = await document(fixture.account)
      await prepare(other.head.docId, "original", "next", fixture.account)
      const before = await retainedCounts(fixture.account)
      await expect(
        prepare(other.head.docId, "original", "overflow", fixture.account)
      ).rejects.toThrow("Word edit storage is full")
      expect(await retainedCounts(fixture.account)).toEqual(before)
      expect(
        (await readWordPackage(fixture.account, { docId: other.head.docId }))
          .revision
      ).toBe(other.head.revision)
      expect(
        (
          await prepare(
            (await document(stranger)).head.docId,
            "original",
            "other",
            stranger
          )
        ).prepared.review
      ).toBeDefined()
      const committed = await transaction(() =>
        commitWordCandidate(fixture.account, fixture.input, fixture.prepared)
      )
      const restored = await transaction(() =>
        restoreWordCandidate(
          fixture.account,
          committed.restore,
          committed.revision
        )
      )
      expect(
        (
          await exportWordPackage(
            fixture.account,
            fixture.doc.head.docId,
            restored.revision
          )
        ).bytes
      ).toEqual(fixture.doc.bytes)
    }))

  it("refuses retained JSON byte pressure before inserting any artifact", () =>
    run(async () => {
      const fixture = await retentionFixture(1)
      const [version] = await getDb()
        .select()
        .from(paperPackageVersions)
        .where(eq(paperPackageVersions.revision, fixture.row.forwardRevision))
      if (!version) throw new Error("Missing fixture version")
      const revision = randomUUID()
      await getDb()
        .insert(paperPackageVersions)
        .values({
          ...version,
          revision,
          requestId: randomUUID(),
          projection: sql`jsonb_build_object('retentionFixture', repeat('x', ${64 * 1024 * 1024}))`,
        })
      await getDb()
        .insert(paperPackageCandidates)
        .values({
          ...fixture.row,
          id: randomUUID(),
          forwardRevision: revision,
        })
      const before = await retainedCounts(fixture.account)
      await expect(
        prepare(fixture.doc.head.docId, "original", "overflow", fixture.account)
      ).rejects.toThrow("Word edit storage is full")
      expect(await retainedCounts(fixture.account)).toEqual(before)
      expect(
        (
          await readWordPackage(fixture.account, {
            docId: fixture.doc.head.docId,
          })
        ).revision
      ).toBe(fixture.doc.head.revision)
    }))

  it.skipIf(!REAL)(
    "serializes the last owner capacity slot across two documents",
    () =>
      run(async () => {
        const fixture = await retentionFixture(63)
        const other = await document(fixture.account)
        const original = packageStore.wordPackageBasis
        const reads = new Map<string, number>()
        let release = () => {}
        const ready = new Promise<void>((resolve) => {
          release = resolve
        })
        let waiting = 0
        const spy = vi
          .spyOn(packageStore, "wordPackageBasis")
          .mockImplementation(async (...args) => {
            const basis = await original(...args)
            const count = (reads.get(args[1]) ?? 0) + 1
            reads.set(args[1], count)
            if (count === 2) {
              waiting += 1
              if (waiting === 2) release()
              await ready
            }
            return basis
          })
        try {
          const results = await Promise.allSettled([
            prepare(
              fixture.doc.head.docId,
              "original",
              "first",
              fixture.account
            ),
            prepare(other.head.docId, "original", "second", fixture.account),
          ])
          expect(
            results.filter((result) => result.status === "fulfilled")
          ).toHaveLength(1)
          const rejected = results.find(
            (result) => result.status === "rejected"
          )
          expect(
            rejected?.status === "rejected" && rejected.reason
          ).toMatchObject({
            message: expect.stringContaining("Word edit storage is full"),
          })
          expect(await retainedCounts(fixture.account)).toEqual([
            [{ count: 4 }],
            [{ count: 6 }],
            [{ count: 64 }],
          ])
          expect(
            (
              await readWordPackage(fixture.account, {
                docId: fixture.doc.head.docId,
              })
            ).revision
          ).toBe(fixture.doc.head.revision)
          expect(
            (
              await readWordPackage(fixture.account, {
                docId: other.head.docId,
              })
            ).revision
          ).toBe(other.head.revision)
        } finally {
          spy.mockRestore()
        }
      })
  )
})
