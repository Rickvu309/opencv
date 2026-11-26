import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import {
  type WordCommit,
  type WordFile,
  type WordPage,
  type WordRefusal,
} from "@workspace/domain/paper-doc"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { eq } from "drizzle-orm"

import { getDb, withDatabase } from "../../../db/context.js"
import { paperPackageVersions, user } from "../../../db/schema.js"
import {
  openBackend,
  type Backend,
} from "../../../test/registry-formal-support.js"
import { apply, exportWord, open, undo } from "./document.js"

const loaded = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
) as { mainXml: (bytes: Uint8Array) => string }

let backend: Backend
const run = <T>(fn: () => Promise<T>) => withDatabase(backend.db, fn)

beforeAll(async () => {
  backend = await openBackend()
})

afterAll(async () => {
  await backend?.close()
})

async function seed() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

function pageOf(value: WordPage | WordRefusal): WordPage {
  if ("refused" in value) throw new Error(value.message)
  return value
}

function saved(value: WordCommit | WordRefusal): WordCommit {
  if (value.refused) throw new Error(value.message)
  return value
}

function fileOf(value: WordFile | WordRefusal): WordFile {
  if ("refused" in value) throw new Error(value.message)
  return value
}

function refused(
  value: WordCommit | WordPage | WordFile | WordRefusal
): WordRefusal {
  if (!("refused" in value) || !value.refused)
    throw new Error("expected a refusal")
  return value
}

async function storedVersions(owner: string) {
  const rows = await getDb()
    .select({ revision: paperPackageVersions.revision })
    .from(paperPackageVersions)
    .where(eq(paperPackageVersions.userId, owner))
  return rows.length
}

async function mint(owner: string) {
  return pageOf(
    await open(owner, { kind: "mint", name: "Page.docx", label: "letter" })
  )
}

describe("word document module", () => {
  it("saves the first words on a blank page and exports those bytes", () =>
    run(async () => {
      const owner = await seed()
      const blank = await mint(owner)
      expect(blank.paragraphs).toHaveLength(1)
      expect(blank.paragraphs[0]?.text).toBe("")
      expect(blank.paragraphs[0]?.held).toBe(false)
      const handle = blank.paragraphs[0]?.handle
      if (!handle) throw new Error("missing handle")
      const wrote = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [{ op: "setText", handle, text: "Hello" }],
        })
      )
      expect(wrote.page.revision).not.toBe(blank.revision)
      expect(wrote.page.paragraphs[0]?.text).toBe("Hello")
      expect(wrote.page.paragraphs[0]?.handle).toBe(handle)
      expect(wrote.undo?.revision).toBe(wrote.page.revision)
      expect(wrote.undo?.restore).toBe(blank.revision)
      const file = fileOf(
        await exportWord(owner, blank.doc, wrote.page.revision)
      )
      expect(file.mediaType).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
      expect(file.revision).toBe(wrote.page.revision)
      expect(loaded.mainXml(file.bytes)).toContain("Hello")
      const again = pageOf(await open(owner, { kind: "read", doc: blank.doc }))
      expect(again.revision).toBe(wrote.page.revision)
      expect(again.paragraphs[0]?.text).toBe("Hello")
    }))

  it("splits a paragraph as one batch", () =>
    run(async () => {
      const owner = await seed()
      const blank = await mint(owner)
      const handle = blank.paragraphs[0]?.handle
      if (!handle) throw new Error("missing handle")
      const wrote = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [{ op: "setText", handle, text: "Hello" }],
        })
      )
      const split = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: wrote.page.revision,
          ops: [
            { op: "setText", handle, text: "Hel" },
            { op: "insert", after: handle, text: "lo" },
          ],
        })
      )
      expect(split.page.paragraphs.map((item) => item.text)).toEqual([
        "Hel",
        "lo",
      ])
      expect(split.page.paragraphs.every((item) => !item.held)).toBe(true)
      expect(split.undo?.restore).toBe(wrote.page.revision)
      const head = pageOf(await open(owner, { kind: "read", doc: blank.doc }))
      expect(head).toEqual(split.page)
    }))

  it("joins a paragraph as one batch", () =>
    run(async () => {
      const owner = await seed()
      const blank = await mint(owner)
      const handle = blank.paragraphs[0]?.handle
      if (!handle) throw new Error("missing handle")
      const wrote = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [{ op: "setText", handle, text: "Hello" }],
        })
      )
      const split = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: wrote.page.revision,
          ops: [
            { op: "setText", handle, text: "Hel" },
            { op: "insert", after: handle, text: "lo" },
          ],
        })
      )
      const left = split.page.paragraphs[0]?.handle
      const right = split.page.paragraphs[1]?.handle
      if (!left || !right) throw new Error("missing handles")
      const joined = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: split.page.revision,
          ops: [
            { op: "setText", handle: left, text: "Hello" },
            { op: "delete", handle: right },
          ],
        })
      )
      expect(joined.page.paragraphs.map((item) => item.text)).toEqual(["Hello"])
    }))

  it("deletes an empty paragraph", () =>
    run(async () => {
      const owner = await seed()
      const blank = await mint(owner)
      const handle = blank.paragraphs[0]?.handle
      if (!handle) throw new Error("missing handle")
      const split = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [
            { op: "setText", handle, text: "" },
            { op: "insert", after: handle, text: "" },
          ],
        })
      )
      const extra = split.page.paragraphs[1]?.handle
      if (!extra) throw new Error("missing inserted paragraph")
      const removed = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: split.page.revision,
          ops: [{ op: "delete", handle: extra }],
        })
      )
      expect(removed.page.paragraphs).toHaveLength(1)
      expect(removed.page.paragraphs[0]?.text).toBe("")
    }))

  it("refuses a stale basis and writes nothing", () =>
    run(async () => {
      const owner = await seed()
      const blank = await mint(owner)
      const handle = blank.paragraphs[0]?.handle
      if (!handle) throw new Error("missing handle")
      const wrote = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [{ op: "setText", handle, text: "Hello" }],
        })
      )
      const before = fileOf(
        await exportWord(owner, blank.doc, wrote.page.revision)
      )
      const versions = await storedVersions(owner)
      const stale = refused(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [{ op: "setText", handle, text: "Nope" }],
        })
      )
      expect(stale.reason).toBe("stale")
      expect(stale.message.length).toBeGreaterThan(0)
      expect(stale.handle).toBe(handle)
      const after = fileOf(
        await exportWord(owner, blank.doc, wrote.page.revision)
      )
      expect(Buffer.from(after.bytes)).toEqual(Buffer.from(before.bytes))
      expect(await storedVersions(owner)).toBe(versions)
      expect(
        pageOf(await open(owner, { kind: "read", doc: blank.doc })).revision
      ).toBe(wrote.page.revision)
    }))

  it("refuses a batch and writes nothing", () =>
    run(async () => {
      const owner = await seed()
      const blank = await mint(owner)
      const handle = blank.paragraphs[0]?.handle
      if (!handle) throw new Error("missing handle")
      const before = fileOf(await exportWord(owner, blank.doc, blank.revision))
      const versions = await storedVersions(owner)
      const rejected = refused(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [
            { op: "delete", handle },
            { op: "delete", handle },
          ],
        })
      )
      expect(rejected.reason).toBe("order")
      expect(rejected.message.length).toBeGreaterThan(0)
      expect(rejected.handle).toBe(handle)
      const broken = refused(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [{ op: "setText", handle, text: "two\nlines" }],
        })
      )
      expect(broken.reason).toBe("plain")
      expect(broken.handle).toBe(handle)
      const unsplit = refused(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [
            { op: "delete", handle },
            { op: "insert", after: handle, text: "invented" },
          ],
        })
      )
      expect(unsplit.reason).toBe("order")
      expect(unsplit.code).toBe("REMOVED_IN_BATCH")
      const after = fileOf(await exportWord(owner, blank.doc, blank.revision))
      expect(Buffer.from(after.bytes)).toEqual(Buffer.from(before.bytes))
      expect(await storedVersions(owner)).toBe(versions)
      expect(
        pageOf(await open(owner, { kind: "read", doc: blank.doc })).revision
      ).toBe(blank.revision)
    }))

  it("undo restores the prior revision", () =>
    run(async () => {
      const owner = await seed()
      const blank = await mint(owner)
      const handle = blank.paragraphs[0]?.handle
      if (!handle) throw new Error("missing handle")
      const before = fileOf(await exportWord(owner, blank.doc, blank.revision))
      const wrote = saved(
        await apply(owner, {
          doc: blank.doc,
          basedOn: blank.revision,
          ops: [{ op: "setText", handle, text: "Hello" }],
        })
      )
      if (!wrote.undo) throw new Error("missing undo")
      const restored = saved(await undo(owner, wrote.undo))
      expect(restored.undo).toBeNull()
      expect(restored.page.revision).toBe(blank.revision)
      expect(restored.page.paragraphs[0]?.text).toBe("")
      const after = fileOf(
        await exportWord(owner, blank.doc, restored.page.revision)
      )
      expect(Buffer.from(after.bytes)).toEqual(Buffer.from(before.bytes))
      const again = refused(await undo(owner, wrote.undo))
      expect(again.reason).toBe("stale")
      expect(again.message.length).toBeGreaterThan(0)
      expect(
        pageOf(await open(owner, { kind: "read", doc: blank.doc })).revision
      ).toBe(blank.revision)
    }))
})
