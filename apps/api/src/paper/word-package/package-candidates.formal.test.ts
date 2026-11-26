import { randomUUID } from "node:crypto"

import { count, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { getDb, transaction, withDatabase } from "../../db/context.js"
import {
  files,
  paperPackageCandidates,
  paperPackageHeads,
  paperPackageVersions,
  user,
} from "../../db/schema.js"
import {
  openBackend,
  type Backend,
} from "../../test/registry-formal-support.js"
import {
  commitWordCandidate,
  prepareStoredWordPackage,
  restoreWordCandidate,
  revalidateWordCandidate,
} from "./package-candidates.js"
import { PaperPackage } from "./package-engine.js"
import { fixturePackage } from "./package-fixtures.js"
import { packageDigest } from "../package-pages.js"
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

async function document() {
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

async function prepare(docId: string, before = "original", after = "better") {
  const page = await readWordPackage(owner, { docId })
  const target = page.regions.find((region) => region.kind === "editable")
  if (!target || target.kind !== "editable")
    throw new Error("Missing fixture target")
  const input = {
    docId,
    basedOn: page.revision,
    edits: [{ op: "replaceText", targetId: target.targetId, before, after }],
  }
  const prepared = await prepareStoredWordPackage(owner, input)
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

async function head(docId: string) {
  return (await readWordPackage(owner, { docId })).revision
}

describe("private Word candidates", () => {
  it.each(["artifact", "projection"] as const)(
    "refuses a changed %s between preparation and retention without staging a candidate",
    (changed) =>
      run(async () => {
        const doc = await document()
        const before = await getDb()
          .select({ count: count() })
          .from(paperPackageVersions)
        const candidates = await getDb()
          .select({ count: count() })
          .from(paperPackageCandidates)
        const basis = packageStore.wordPackageBasis
        let reads = 0
        const spy = vi
          .spyOn(packageStore, "wordPackageBasis")
          .mockImplementation(async (...args) => {
            const result = await basis(...args)
            reads += 1
            if (reads === 2) {
              if (changed === "artifact") {
                const damaged = Buffer.from(result.artifact.bytes)
                damaged[0] = (damaged[0] ?? 0) ^ 1
                await getDb()
                  .update(files)
                  .set({ bytes: damaged })
                  .where(eq(files.id, result.version.fileId))
              } else
                await getDb()
                  .update(paperPackageVersions)
                  .set({ projectionHash: "0".repeat(64) })
                  .where(
                    eq(paperPackageVersions.revision, result.version.revision)
                  )
            }
            return result
          })
        try {
          await expect(prepare(doc.head.docId)).rejects.toThrow()
          expect(reads).toBe(2)
          expect(
            await getDb().select({ count: count() }).from(paperPackageVersions)
          ).toEqual(before)
          expect(
            await getDb()
              .select({ count: count() })
              .from(paperPackageCandidates)
          ).toEqual(candidates)
          const [current] = await getDb()
            .select()
            .from(paperPackageHeads)
            .where(eq(paperPackageHeads.docId, doc.head.docId))
          expect(current?.revision).toBe(doc.head.revision)
        } finally {
          spy.mockRestore()
        }
      })
  )

  it("retains exact forward and fresh restore bytes, projection and cumulative history without publishing", () =>
    run(async () => {
      const doc = await document()
      const { input, prepared } = await prepare(doc.head.docId)
      expect(Object.keys(prepared.candidate).sort()).toEqual(["digest", "id"])
      expect(JSON.parse(JSON.stringify(prepared.candidate))).toEqual(
        prepared.candidate
      )
      expect(prepared.review.changes[0]?.before).toBe("original")
      expect(await head(doc.head.docId)).toBe(doc.head.revision)
      expect(
        (
          await exportWordPackage(
            owner,
            doc.head.docId,
            await head(doc.head.docId)
          )
        ).bytes
      ).toEqual(doc.bytes)
      const retained = await record(prepared.candidate)
      for (const revision of [
        retained.forwardRevision,
        retained.restoreRevision,
      ]) {
        await expect(
          readWordPackage(owner, { docId: doc.head.docId, at: revision })
        ).rejects.toThrow()
        await expect(
          exportWordPackage(owner, doc.head.docId, revision)
        ).rejects.toThrow()
      }
      const applied = await transaction(() =>
        commitWordCandidate(owner, input, prepared)
      )
      expect(applied.revision).toBe(retained.forwardRevision)
      const changed = await exportWordPackage(
        owner,
        doc.head.docId,
        applied.revision
      )
      const restored = await transaction(() =>
        restoreWordCandidate(owner, applied.restore, applied.revision)
      )
      expect(restored.revision).toBe(retained.restoreRevision)
      expect(restored.revision).not.toBe(doc.head.revision)
      const result = await exportWordPackage(
        owner,
        doc.head.docId,
        restored.revision
      )
      expect(result.bytes).toEqual(doc.bytes)
      const versions = await getDb()
        .select()
        .from(paperPackageVersions)
        .where(eq(paperPackageVersions.docId, doc.head.docId))
      const forward = versions.find(
        (version) => version.revision === applied.revision
      )
      const undo = versions.find(
        (version) => version.revision === restored.revision
      )
      if (!forward || !undo) throw new Error("Missing retained versions")
      const forwardPackage = await PaperPackage.open(
        changed.bytes,
        {
          docId: doc.head.docId,
          incarnation: retained.incarnation,
          revision: applied.revision,
        },
        forward.sidecar
      )
      const undoPackage = await PaperPackage.open(
        result.bytes,
        {
          docId: doc.head.docId,
          incarnation: retained.incarnation,
          revision: restored.revision,
        },
        undo.sidecar
      )
      expect(undoPackage.sidecar().paragraphs[0]?.textIds).toEqual(
        forwardPackage.sidecar().paragraphs[0]?.textIds
      )
      expect(undoPackage.sidecar().paragraphs[0]?.textIds).toHaveLength(2)
      expect(packageDigest(undoPackage.read())).toBe(undo.projectionHash)
      const target = (
        await readWordPackage(owner, { docId: doc.head.docId })
      ).regions.find((region) => region.kind === "editable")
      expect(target?.kind === "editable" && target.targetId).not.toBe(
        input.edits[0]?.targetId
      )
      await expect(
        transaction(() =>
          restoreWordCandidate(owner, applied.restore, applied.revision)
        )
      ).rejects.toThrow()
    }))

  it("rejects changed input, review, handle, owner and document identities without moving the head", () =>
    run(async () => {
      const doc = await document()
      const other = await document()
      const { input, prepared } = await prepare(doc.head.docId)
      const attempts = [
        () => commitWordCandidate(stranger, input, prepared),
        () =>
          commitWordCandidate(
            owner,
            { ...input, docId: other.head.docId },
            prepared
          ),
        () =>
          commitWordCandidate(
            owner,
            { ...input, edits: [{ ...input.edits[0], after: "wrong" }] },
            prepared
          ),
        () => commitWordCandidate(owner, input, { ...prepared, review: {} }),
        () =>
          commitWordCandidate(owner, input, {
            ...prepared,
            candidate: { ...prepared.candidate, digest: "0".repeat(64) },
          }),
        () =>
          commitWordCandidate(owner, input, {
            ...prepared,
            candidate: { ...prepared.candidate, id: randomUUID() },
          }),
      ]
      for (const attempt of attempts)
        await expect(transaction(attempt)).rejects.toThrow()
      expect(await head(doc.head.docId)).toBe(doc.head.revision)
      expect(
        (
          await exportWordPackage(
            owner,
            doc.head.docId,
            await head(doc.head.docId)
          )
        ).bytes
      ).toEqual(doc.bytes)
    }))

  it("requires preparation outside SQL and publication inside the caller transaction", () =>
    run(async () => {
      const doc = await document()
      const { input, prepared } = await prepare(doc.head.docId)
      await expect(
        transaction(() => prepareStoredWordPackage(owner, input))
      ).rejects.toThrow("before starting")
      await expect(commitWordCandidate(owner, input, prepared)).rejects.toThrow(
        "inside its command transaction"
      )
      await expect(
        restoreWordCandidate(owner, prepared.candidate, doc.head.revision)
      ).rejects.toThrow("inside its command transaction")
      expect(await head(doc.head.docId)).toBe(doc.head.revision)
    }))

  it("rolls head publication back with the caller and permits the same frozen candidate afterward", () =>
    run(async () => {
      const doc = await document()
      const { input, prepared } = await prepare(doc.head.docId)
      await expect(
        transaction(async () => {
          await commitWordCandidate(owner, input, prepared)
          throw new Error("receipt failed")
        })
      ).rejects.toThrow("receipt failed")
      expect(await head(doc.head.docId)).toBe(doc.head.revision)
      const result = await transaction(() =>
        commitWordCandidate(owner, input, prepared)
      )
      await expect(
        transaction(async () => {
          await restoreWordCandidate(owner, result.restore, result.revision)
          throw new Error("Undo receipt failed")
        })
      ).rejects.toThrow("Undo receipt failed")
      expect(await head(doc.head.docId)).toBe(result.revision)
    }))

  it("allows one concurrent winner and refuses the stale candidate and clean Undo after newer typing", () =>
    run(async () => {
      const doc = await document()
      const first = await prepare(doc.head.docId)
      const second = await prepare(doc.head.docId, "original", "different")
      const results = await Promise.allSettled(
        [first, second].map(({ input, prepared }) =>
          transaction(() => commitWordCandidate(owner, input, prepared))
        )
      )
      expect(
        results.filter((result) => result.status === "fulfilled")
      ).toHaveLength(1)
      expect(
        results.filter((result) => result.status === "rejected")
      ).toHaveLength(1)
      const winner = results.find((result) => result.status === "fulfilled")
      if (!winner || winner.status !== "fulfilled")
        throw new Error("Missing winner")
      const next = await prepare(
        doc.head.docId,
        winner.value.revision ===
          (await record(first.prepared.candidate)).forwardRevision
          ? "better"
          : "different",
        "latest"
      )
      const newer = await transaction(() =>
        commitWordCandidate(owner, next.input, next.prepared)
      )
      const bytes = (
        await exportWordPackage(
          owner,
          doc.head.docId,
          await head(doc.head.docId)
        )
      ).bytes
      await expect(
        transaction(() =>
          restoreWordCandidate(
            owner,
            winner.value.restore,
            winner.value.revision
          )
        )
      ).rejects.toThrow()
      expect(await head(doc.head.docId)).toBe(newer.revision)
      expect(
        (
          await exportWordPackage(
            owner,
            doc.head.docId,
            await head(doc.head.docId)
          )
        ).bytes
      ).toEqual(bytes)
    }))

  it("refuses ABA document incarnations and swapped restore expectations", () =>
    run(async () => {
      const doc = await document()
      const { input, prepared } = await prepare(doc.head.docId)
      const old = (
        await getDb()
          .select()
          .from(paperPackageVersions)
          .where(eq(paperPackageVersions.revision, doc.head.revision))
      )[0]
      if (!old) throw new Error("Missing basis")
      const incarnation = randomUUID()
      const revision = randomUUID()
      await getDb()
        .insert(paperPackageVersions)
        .values({ ...old, revision, incarnation, requestId: randomUUID() })
      await getDb()
        .update(paperPackageHeads)
        .set({ incarnation, revision })
        .where(eq(paperPackageHeads.docId, doc.head.docId))
      await expect(
        transaction(() => revalidateWordCandidate(owner, input, prepared))
      ).rejects.toThrow()
      await expect(
        transaction(() =>
          restoreWordCandidate(owner, prepared.candidate, randomUUID())
        )
      ).rejects.toThrow()
      const [actual] = await getDb()
        .select()
        .from(paperPackageHeads)
        .where(eq(paperPackageHeads.docId, doc.head.docId))
      expect(actual?.revision).toBe(revision)
    }))

  it("enforces retained file, version and seal immutability and referential completeness in the database", () =>
    run(async () => {
      const doc = await document()
      const { input, prepared } = await prepare(doc.head.docId)
      const retained = await record(prepared.candidate)
      const [version] = await getDb()
        .select()
        .from(paperPackageVersions)
        .where(eq(paperPackageVersions.revision, retained.forwardRevision))
      if (!version) throw new Error("Missing forward version")
      await expect(
        getDb()
          .update(files)
          .set({ bytes: Buffer.from("wrong") })
          .where(eq(files.id, version.fileId))
      ).rejects.toThrow()
      await expect(
        getDb()
          .update(paperPackageVersions)
          .set({ projectionHash: "0".repeat(64) })
          .where(eq(paperPackageVersions.revision, version.revision))
      ).rejects.toThrow()
      await expect(
        getDb()
          .update(paperPackageCandidates)
          .set({ seal: {} })
          .where(eq(paperPackageCandidates.id, retained.id))
      ).rejects.toThrow()
      await expect(
        getDb().delete(files).where(eq(files.id, version.fileId))
      ).rejects.toThrow()
      await expect(
        getDb()
          .delete(paperPackageVersions)
          .where(eq(paperPackageVersions.revision, retained.restoreRevision))
      ).rejects.toThrow()
      expect(await head(doc.head.docId)).toBe(doc.head.revision)
      await transaction(() => commitWordCandidate(owner, input, prepared))
    }))

  it("lets a retained Word version change only its name, and refuses name together with any other column", () =>
    run(async () => {
      const doc = await document()
      const { prepared } = await prepare(doc.head.docId)
      const retained = await record(prepared.candidate)
      const versionAt = async () => {
        const [row] = await getDb()
          .select()
          .from(paperPackageVersions)
          .where(eq(paperPackageVersions.revision, retained.forwardRevision))
        if (!row) throw new Error("Missing forward version")
        return row
      }
      const before = await versionAt()
      const otherColumns: Partial<typeof paperPackageVersions.$inferInsert>[] =
        [
          { revision: randomUUID() },
          { parentRevision: randomUUID() },
          { docId: randomUUID() },
          { incarnation: randomUUID() },
          { userId: stranger },
          { requestId: randomUUID() },
          { kind: before.kind === "cv" ? "letter" : "cv" },
          { fileId: randomUUID() },
          { packageHash: "0".repeat(64) },
          { byteSize: before.byteSize + 1 },
          { sidecar: { tampered: true } },
          { sidecarHash: "0".repeat(64) },
          { projection: { tampered: true } },
          { projectionHash: "0".repeat(64) },
          { projector: "tampered" },
          { cursorKey: "tampered" },
          { createdAt: new Date(0) },
        ]
      for (const change of otherColumns) {
        const refused = await getDb()
          .update(paperPackageVersions)
          .set({ name: "Renamed.docx", ...change })
          .where(eq(paperPackageVersions.revision, retained.forwardRevision))
          .then(
            () => "allowed",
            (error: unknown) =>
              String(
                (error as { cause?: { message?: string } }).cause?.message ??
                  error
              )
          )
        expect(refused, Object.keys(change).join()).toContain(
          "Retained Word versions and candidates cannot be changed"
        )
      }
      expect(await versionAt()).toEqual(before)
      await getDb()
        .update(paperPackageVersions)
        .set({ name: "Renamed.docx" })
        .where(eq(paperPackageVersions.revision, retained.forwardRevision))
      expect(await versionAt()).toEqual({ ...before, name: "Renamed.docx" })
    }))

  it("keeps no-op preparation free of retained candidates and never publishes it", () =>
    run(async () => {
      const doc = await document()
      const page = await readWordPackage(owner, { docId: doc.head.docId })
      const target = page.regions.find((region) => region.kind === "editable")
      if (!target || target.kind !== "editable")
        throw new Error("Missing target")
      const before = await getDb()
        .select({ count: count() })
        .from(paperPackageCandidates)
      const result = await prepareStoredWordPackage(owner, {
        docId: doc.head.docId,
        basedOn: page.revision,
        edits: [
          {
            op: "replaceText",
            targetId: target.targetId,
            before: "original",
            after: "original",
          },
        ],
      })
      expect(result.kind).toBe("unchanged")
      expect(
        await getDb().select({ count: count() }).from(paperPackageCandidates)
      ).toEqual(before)
      expect(await head(doc.head.docId)).toBe(doc.head.revision)
    }))
})
