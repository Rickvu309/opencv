import { randomUUID } from "node:crypto"

import { count, eq, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
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
} from "./word-package/package-candidates.js"
import { fixturePackage } from "./word-package/package-fixtures.js"
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

async function retentionFixture(copies: number, after = "better") {
  const account = randomUUID()
  await getDb()
    .insert(user)
    .values({
      id: account,
      name: account,
      email: `${account}@test.invalid`,
    })
  const doc = await document(account)
  const retained = await prepare(doc.head.docId, "original", after, account)
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

const byteLimit = 64 * 1024 * 1024

async function usageBytes(account: string) {
  const forward = alias(paperPackageVersions, "usage_forward")
  const restore = alias(paperPackageVersions, "usage_restore")
  const [row] = await getDb()
    .select({
      bytes: sql<number>`coalesce(sum(
        ${forward.byteSize}::bigint + ${restore.byteSize}::bigint
        + octet_length(${paperPackageCandidates.seal}::text)
        + octet_length(${forward.sidecar}::text)
        + octet_length(${forward.projection}::text)
        + octet_length(${restore.sidecar}::text)
        + octet_length(${restore.projection}::text)
      ), 0)`.mapWith(Number),
    })
    .from(paperPackageCandidates)
    .innerJoin(
      forward,
      eq(forward.revision, paperPackageCandidates.forwardRevision)
    )
    .innerJoin(
      restore,
      eq(restore.revision, paperPackageCandidates.restoreRevision)
    )
    .where(eq(paperPackageCandidates.userId, account))
  return row?.bytes ?? 0
}

async function incomingBytes(account: string) {
  const forward = alias(paperPackageVersions, "incoming_forward")
  const restore = alias(paperPackageVersions, "incoming_restore")
  const [row] = await getDb()
    .select({
      bytes: sql<number>`coalesce(sum(
        ${forward.byteSize}::bigint + ${restore.byteSize}::bigint
        + octet_length(jsonb_build_array(
          ${paperPackageCandidates.seal},
          ${forward.sidecar},
          ${forward.projection},
          ${restore.sidecar},
          ${restore.projection}
        )::text)
      ), 0)`.mapWith(Number),
    })
    .from(paperPackageCandidates)
    .innerJoin(
      forward,
      eq(forward.revision, paperPackageCandidates.forwardRevision)
    )
    .innerJoin(
      restore,
      eq(restore.revision, paperPackageCandidates.restoreRevision)
    )
    .where(eq(paperPackageCandidates.userId, account))
  return row?.bytes ?? 0
}

async function projectionGap(revision: string) {
  const [row] = await getDb()
    .select({
      gap: sql<number>`octet_length(${paperPackageVersions.projection}::text) - length(${paperPackageVersions.projection}::text)`.mapWith(
        Number
      ),
    })
    .from(paperPackageVersions)
    .where(eq(paperPackageVersions.revision, revision))
  return row?.gap ?? 0
}

async function copiedCandidateOverhead(account: string) {
  const forward = alias(paperPackageVersions, "overhead_forward")
  const restore = alias(paperPackageVersions, "overhead_restore")
  const [row] = await getDb()
    .select({
      bytes: sql<number>`coalesce(sum(
        ${forward.byteSize}::bigint + ${restore.byteSize}::bigint
        + octet_length(${paperPackageCandidates.seal}::text)
        + octet_length(${forward.sidecar}::text)
        + octet_length(${forward.projection}::text)
        + octet_length(${restore.sidecar}::text)
      ), 0)`.mapWith(Number),
    })
    .from(paperPackageCandidates)
    .innerJoin(
      forward,
      eq(forward.revision, paperPackageCandidates.forwardRevision)
    )
    .innerJoin(
      restore,
      eq(restore.revision, paperPackageCandidates.restoreRevision)
    )
    .where(eq(paperPackageCandidates.userId, account))
  return row?.bytes ?? 0
}

async function holdUsage(
  fixture: Awaited<ReturnType<typeof retentionFixture>>,
  target: number,
  fill: string
) {
  const [version] = await getDb()
    .select()
    .from(paperPackageVersions)
    .where(eq(paperPackageVersions.revision, fixture.row.restoreRevision))
  if (!version) throw new Error("Missing restore version")
  const [widths] = await getDb()
    .select({
      empty:
        sql<number>`octet_length(jsonb_build_object('retentionFixture', '')::text)`.mapWith(
          Number
        ),
      one: sql<number>`octet_length(jsonb_build_object('retentionFixture', ${fill}::text)::text)`.mapWith(
        Number
      ),
      mark: sql<number>`octet_length(jsonb_build_object('retentionFixture', 'x')::text)`.mapWith(
        Number
      ),
    })
    .from(user)
    .where(eq(user.id, fixture.account))
  if (!widths) throw new Error("Missing retention pad widths")
  const per = widths.one - widths.empty
  const mark = widths.mark - widths.empty
  if (per < 1 || mark < 1)
    throw new Error("Retention pad character added no bytes")
  const content =
    target -
    (await usageBytes(fixture.account)) -
    (await copiedCandidateOverhead(fixture.account)) -
    widths.empty
  if (content < 0)
    throw new Error(`Retention pad content ${content} is negative`)
  const copies = Math.floor(content / per)
  const remainder = content - copies * per
  if (remainder % mark !== 0)
    throw new Error(`Retention pad remainder ${remainder} is not a whole mark`)
  const revision = randomUUID()
  const tail = "x".repeat(remainder / mark)
  await getDb()
    .insert(paperPackageVersions)
    .values({
      ...version,
      revision,
      requestId: randomUUID(),
      projection: sql`jsonb_build_object('retentionFixture', repeat(${fill}::text, ${copies}::int) || ${tail}::text)`,
    })
  await getDb()
    .insert(paperPackageCandidates)
    .values({
      ...fixture.row,
      id: randomUUID(),
      restoreRevision: revision,
    })
  const charged = await usageBytes(fixture.account)
  if (charged !== target)
    throw new Error(`Charged ${charged} instead of ${target}`)
  return revision
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

  it("refuses when only the new candidate crosses the byte limit", () =>
    run(async () => {
      const fixture = await retentionFixture(1, "bétter")
      const unit = await incomingBytes(fixture.account)
      if (unit < 1) throw new Error("Missing incoming candidate bytes")
      const revision = await holdUsage(fixture, byteLimit - unit + 1, "é")
      const gap = await projectionGap(revision)
      if (gap <= unit)
        throw new Error(`Byte gap ${gap} does not exceed one candidate`)
      const before = await retainedCounts(fixture.account)
      await expect(
        prepare(fixture.doc.head.docId, "original", "bétter", fixture.account)
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

  it("accepts a candidate that lands exactly on the byte limit", () =>
    run(async () => {
      const fixture = await retentionFixture(1, "bétter")
      const unit = await incomingBytes(fixture.account)
      if (unit < 1) throw new Error("Missing incoming candidate bytes")
      await holdUsage(fixture, byteLimit - unit, "x")
      const before = await retainedCounts(fixture.account)
      const accepted = await prepare(
        fixture.doc.head.docId,
        "original",
        "bétter",
        fixture.account
      )
      expect(accepted.prepared.candidate.id).toBeTruthy()
      const after = await retainedCounts(fixture.account)
      expect(after).toEqual([
        [{ count: before[0][0].count + 1 }],
        [{ count: before[1][0].count + 2 }],
        [{ count: before[2][0].count + 1 }],
      ])
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
