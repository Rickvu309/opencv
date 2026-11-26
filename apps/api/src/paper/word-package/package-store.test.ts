import { randomUUID } from "node:crypto"

import { parseFileId, parseUserId, personActor } from "@workspace/domain/kernel"
import { and, count, eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { transaction, withDatabase } from "../../db/context.js"
import {
  files,
  paperPackageHeads,
  paperPackageVersions,
  user,
} from "../../db/schema.js"
import {
  openBackend,
  type Backend,
} from "../../test/registry-formal-support.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import { archiveDigest, decodePackageCursor } from "./package-pages.js"
import {
  exportWordPackage,
  listWordPackages,
  publishWordPackage,
  readWordPackage,
  stageWordPackage,
} from "./package-store.js"
import { deleteFile, listFiles } from "../store.js"

let backend: Backend
const owner = randomUUID()
const stranger = randomUUID()
const bytes = fixturePackage(paragraph("Original words"))
const input = () => ({
  requestId: randomUUID(),
  name: "My CV.docx",
  kind: "cv",
})
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
afterAll(async () => {
  await backend?.close()
})

describe("immutable Word persistence", () => {
  it("stages privately, publishes once and exports the exact input archive", () =>
    run(async () => {
      const request = input()
      const staged = await stageWordPackage(owner, request, bytes)
      expect(
        (await listWordPackages(owner)).items.some(
          (item) => item.docId === staged.docId
        )
      ).toBe(false)
      await expect(
        readWordPackage(owner, { docId: staged.docId })
      ).rejects.toThrow("not available")
      expect(await stageWordPackage(owner, request, bytes)).toEqual(staged)
      const head = await publishWordPackage(owner, staged.stageId)
      expect(await publishWordPackage(owner, staged.stageId)).toEqual(head)
      const page = await readWordPackage(owner, { docId: head.docId })
      expect(page.regions[0]).toMatchObject({
        kind: "editable",
        text: "Original words",
      })
      expect(page.revision).toBe(staged.revision)
      const exported = await exportWordPackage(owner, head.docId, head.revision)
      expect(exported.bytes).toEqual(bytes)
      expect(archiveDigest(exported.bytes)).toBe(head.packageHash)
      const row = (
        await backend.db
          .select()
          .from(paperPackageVersions)
          .where(eq(paperPackageVersions.revision, head.revision))
      )[0]
      expect(row?.parentRevision).toBeNull()
      expect(row?.sidecar).toMatchObject({
        docId: head.docId,
        revision: head.revision,
      })
      expect(row?.projection).toMatchObject({
        docId: head.docId,
        revision: head.revision,
      })
      expect(
        (await listFiles(parseUserId(owner))).some(
          (file) => file.id === row?.fileId
        )
      ).toBe(false)
      if (!row) throw new Error("Missing staged version")
      await expect(
        deleteFile(personActor(owner), parseFileId(row.fileId))
      ).rejects.toThrow("File not found")
    }))

  it("refuses changed retry content and metadata without creating an artifact", () =>
    run(async () => {
      const request = input()
      const first = await stageWordPackage(owner, request, bytes)
      await expect(
        stageWordPackage(owner, request, fixturePackage(paragraph("Other")))
      ).rejects.toThrow("already used")
      await expect(
        stageWordPackage(owner, { ...request, name: "other.docx" }, bytes)
      ).rejects.toThrow("already used")
      const rows = await backend.db
        .select()
        .from(paperPackageVersions)
        .where(
          and(
            eq(paperPackageVersions.userId, owner),
            eq(paperPackageVersions.requestId, request.requestId)
          )
        )
      expect(rows.map((row) => row.revision)).toEqual([first.revision])
    }))

  it("refuses cross-owner staging, library, reads, export and missing snapshots", () =>
    run(async () => {
      const staged = await stageWordPackage(owner, input(), bytes)
      await expect(
        publishWordPackage(stranger, staged.stageId)
      ).rejects.toThrow("not available")
      await publishWordPackage(owner, staged.stageId)
      expect((await listWordPackages(stranger)).items).toEqual([])
      await expect(
        readWordPackage(stranger, { docId: staged.docId })
      ).rejects.toThrow("not available")
      await expect(
        exportWordPackage(stranger, staged.docId, staged.revision)
      ).rejects.toThrow("not available")
      await expect(
        readWordPackage(owner, { docId: staged.docId, at: randomUUID() })
      ).rejects.toThrow("not available")
      await expect(
        exportWordPackage(owner, staged.docId, randomUUID())
      ).rejects.toThrow("not available")
    }))

  it("rolls back publication and refuses unfinished and mismatched heads at the database boundary", () =>
    run(async () => {
      const staged = await stageWordPackage(owner, input(), bytes)
      await expect(
        transaction(async () => {
          await publishWordPackage(owner, staged.stageId)
          throw new Error("rollback fixture")
        })
      ).rejects.toThrow("rollback fixture")
      await expect(
        readWordPackage(owner, { docId: staged.docId })
      ).rejects.toThrow("not available")
      await expect(
        backend.db.insert(paperPackageHeads).values({
          docId: randomUUID(),
          userId: owner,
          incarnation: randomUUID(),
          revision: randomUUID(),
        })
      ).rejects.toThrow()
      const version = (
        await backend.db
          .select()
          .from(paperPackageVersions)
          .where(eq(paperPackageVersions.revision, staged.revision))
      )[0]
      if (!version) throw new Error("Missing stage")
      await expect(
        backend.db.insert(paperPackageHeads).values({
          docId: version.docId,
          userId: stranger,
          incarnation: version.incarnation,
          revision: version.revision,
        })
      ).rejects.toThrow()
      expect((await publishWordPackage(owner, staged.stageId)).revision).toBe(
        staged.revision
      )
    }))

  it.each(["files", "paper_package_versions"])(
    "rolls back every artifact when writing %s fails",
    (table) =>
      run(async () => {
        const beforeFiles = await backend.db
          .select({ value: count() })
          .from(files)
        const beforeVersions = await backend.db
          .select({ value: count() })
          .from(paperPackageVersions)
        await backend.db.execute(
          sql`CREATE FUNCTION opencv_app.fail_package_write() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'fixture storage failure'; END $$ LANGUAGE plpgsql`
        )
        await backend.db.execute(
          sql.raw(
            `CREATE TRIGGER package_fixture BEFORE INSERT ON opencv_app.${table} FOR EACH ROW EXECUTE FUNCTION opencv_app.fail_package_write()`
          )
        )
        try {
          await expect(
            stageWordPackage(owner, input(), bytes)
          ).rejects.toThrow()
        } finally {
          await backend.db.execute(
            sql.raw(`DROP TRIGGER package_fixture ON opencv_app.${table}`)
          )
          await backend.db.execute(
            sql`DROP FUNCTION opencv_app.fail_package_write()`
          )
        }
        expect(await backend.db.select({ value: count() }).from(files)).toEqual(
          beforeFiles
        )
        expect(
          await backend.db.select({ value: count() }).from(paperPackageVersions)
        ).toEqual(beforeVersions)
      })
  )

  it("refuses corrupt artifacts and projection shadows before publication", () =>
    run(async () => {
      for (const change of [{ bytes: Buffer.from("broken") }, { bytes }]) {
        const staged = await stageWordPackage(owner, input(), bytes)
        const row = (
          await backend.db
            .select()
            .from(paperPackageVersions)
            .where(eq(paperPackageVersions.revision, staged.revision))
        )[0]
        if (!row) throw new Error("Missing stage")
        await backend.db
          .update(files)
          .set(change)
          .where(eq(files.id, row.fileId))
        if (change.bytes === bytes)
          await backend.db
            .update(paperPackageVersions)
            .set({ projection: { regions: [] } })
            .where(eq(paperPackageVersions.revision, staged.revision))
        await expect(publishWordPackage(owner, staged.stageId)).rejects.toThrow(
          "incomplete"
        )
        await expect(
          readWordPackage(owner, { docId: staged.docId })
        ).rejects.toThrow("not available")
      }
    }))

  it("pins every page and refuses foreign, altered and wrong-version cursors", () =>
    run(async () => {
      const many = fixturePackage(
        Array.from({ length: 39 }, (_, i) =>
          paragraph(`Phrase ${i} &amp; text`)
        ).join("")
      )
      const first = await stageWordPackage(owner, input(), many)
      const second = await stageWordPackage(owner, input(), many)
      await publishWordPackage(owner, first.stageId)
      await publishWordPackage(owner, second.stageId)
      let page = await readWordPackage(owner, { docId: first.docId })
      const cursor = page.nextCursor
      expect(cursor).toBeTruthy()
      if (!cursor) throw new Error("Missing cursor")
      await expect(
        readWordPackage(owner, { docId: second.docId, cursor })
      ).rejects.toThrow("another document")
      await expect(
        readWordPackage(stranger, { docId: first.docId, cursor })
      ).rejects.toThrow("not available")
      await expect(
        readWordPackage(owner, {
          docId: first.docId,
          at: second.revision,
          cursor,
        })
      ).rejects.toThrow("another document")
      const tampered = decodePackageCursor(cursor)
      tampered.position.index += 1
      await expect(
        readWordPackage(owner, {
          docId: first.docId,
          cursor: Buffer.from(JSON.stringify(tampered)).toString("base64url"),
        })
      ).rejects.toThrow("another document")
      const text = page.regions.map((region) => region.text)
      while (page.nextCursor) {
        page = await readWordPackage(owner, {
          docId: first.docId,
          cursor: page.nextCursor,
        })
        expect(page.revision).toBe(first.revision)
        text.push(...page.regions.map((region) => region.text))
      }
      expect(text).toEqual(
        Array.from({ length: 39 }, (_, i) => `Phrase ${i} & text`)
      )
    }))

  it.runIf(Boolean(process.env.FORMAL_DATABASE_URL))(
    "concurrent retries retain one archive and one version",
    () =>
      run(async () => {
        const request = input()
        const before = await backend.db.select({ value: count() }).from(files)
        const results = await Promise.all([
          stageWordPackage(owner, request, bytes),
          stageWordPackage(owner, request, bytes),
        ])
        expect(results[0]).toEqual(results[1])
        const after = await backend.db.select({ value: count() }).from(files)
        expect(after[0]?.value).toBe((before[0]?.value ?? 0) + 1)
      })
  )
})
