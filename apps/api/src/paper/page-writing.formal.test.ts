import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import { personActor, type WordBatch, type WordPage } from "@workspace/domain"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../db/context.js"
import { paperPackageHeads, user } from "../db/schema.js"
import { bindCatalog } from "../registry/bind.js"
import { Registry } from "../registry/registry.js"
import { openBackend, type Backend } from "../test/registry-formal-support.js"
import { registerPaper } from "./commands.js"
import { implementation as readWord } from "./operations/read/server.js"
import { packageMember } from "./package-fixtures.js"
import { publishWordPackage, stageWordPackage } from "./package-store.js"
import { exportWord } from "./word/document.js"

const loaded = createRequire(import.meta.url)(
  "../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  packageFromBody: (body: string) => Uint8Array
  mainXml: (bytes: Uint8Array) => string
  partsExceptMain: (left: Uint8Array, right: Uint8Array) => boolean
}

const SECTION =
  '<w:p><w:pPr><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:pPr></w:p>'
const PLAIN = '<w:rPr><w:color w:val="231F20"/></w:rPr>'
const BOLD = '<w:rPr><w:b/><w:color w:val="231F20"/></w:rPr>'

function line(...runs: string[]) {
  return `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr>${runs.join("")}</w:p>`
}

function piece(text: string, props = PLAIN) {
  const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : ""
  return `<w:r>${props}<w:t${space}>${text}</w:t></w:r>`
}

const TABBED = `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr>${piece("Name")}<w:r>${PLAIN}<w:tab/></w:r>${piece("Role")}</w:p>`

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

async function seed() {
  const id = randomUUID()
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@test.invalid` })
  return id
}

async function headOf(docId: string) {
  const [head] = await getDb()
    .select({ revision: paperPackageHeads.revision })
    .from(paperPackageHeads)
    .where(eq(paperPackageHeads.docId, docId))
  return head?.revision
}

async function page(owner: string, docId: string) {
  return (await registry().read(
    "paper.read",
    { view: "page", docId },
    personActor(owner)
  )) as WordPage
}

async function write(owner: string, batch: WordBatch) {
  return registry().execute({
    name: "paper.canvas",
    input: { op: "write", batch },
    actor: personActor(owner),
    idempotencyKey: randomUUID(),
  })
}

async function bytesAt(owner: string, doc: string, revision: string) {
  const file = await exportWord(owner, doc, revision)
  if ("refused" in file) throw new Error(file.message)
  return file.bytes
}

function handleOf(shown: WordPage, text: string) {
  const found = shown.paragraphs.find((paragraph) => paragraph.text === text)
  if (!found) throw new Error(`missing line ${text}`)
  return found.handle
}

async function importedPage(owner: string) {
  const bytes = loaded.packageFromBody(
    line(piece("Led ", PLAIN), piece("data", BOLD)) +
      line(piece("Hello world")) +
      line(piece("Join me")) +
      line(piece("to this")) +
      line(piece("")) +
      line(piece("Clear me")) +
      TABBED +
      SECTION
  )
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "Imported.docx", kind: "cv" },
    bytes
  )
  const published = await publishWordPackage(owner, stage.stageId)
  return { bytes, shown: await page(owner, published.docId) }
}

describe("the page saves what the person wrote as one Word batch", () => {
  it("writes two lines and a pasted line on a blank page, then undoes them", () =>
    run(async () => {
      const owner = await seed()
      const minted = await registry().execute({
        name: "paper.canvas",
        input: { op: "mint", label: "letter" },
        actor: personActor(owner),
        idempotencyKey: randomUUID(),
      })
      const { docId, revision } = minted.output as {
        docId: string
        revision: string
      }
      const blank = await page(owner, docId)
      const first = blank.paragraphs.find((paragraph) => !paragraph.held)
      if (!first) throw new Error("missing blank line")
      expect(first.text).toBe("")
      const saved = await write(owner, {
        doc: docId,
        basedOn: revision,
        ops: [
          { op: "setText", handle: first.handle, text: "Dear Ada,", caret: 9 },
          {
            op: "insert",
            after: first.handle,
            text: "I write about the role.",
          },
          { op: "insert", after: first.handle, text: "Thank you." },
        ],
      })
      expect(saved.reversal?.command).toBe("paper.undoWord")
      const written = await page(owner, docId)
      expect(written.paragraphs.map((paragraph) => paragraph.text)).toEqual([
        "Dear Ada,",
        "I write about the role.",
        "Thank you.",
      ])
      expect(written.paragraphs[0]?.handle).toBe(first.handle)
      expect(await headOf(docId)).toBe(written.revision)
      await registry().undo(owner, saved.activityId!)
      const undone = await page(owner, docId)
      expect(undone.revision).toBe(revision)
      expect(undone.paragraphs.map((paragraph) => paragraph.text)).toEqual([""])
    }))

  it("saves a split with typing, a join, a paste, a cleared line and a boundary letter at once", () =>
    run(async () => {
      const owner = await seed()
      const { bytes, shown } = await importedPage(owner)
      const led = handleOf(shown, "Led data")
      const hello = handleOf(shown, "Hello world")
      const join = handleOf(shown, "Join me")
      const blank = handleOf(shown, "")
      const clear = handleOf(shown, "Clear me")
      const saved = await write(owner, {
        doc: shown.doc,
        basedOn: shown.revision,
        ops: [
          { op: "setText", handle: led, text: "Led ddata", caret: 5 },
          { op: "setText", handle: hello, text: "Hello there" },
          { op: "insert", after: hello, text: "big world" },
          { op: "setText", handle: join, text: "Join me to this" },
          { op: "delete", handle: handleOf(shown, "to this") },
          { op: "setText", handle: blank, text: "Pasted one" },
          { op: "insert", after: blank, text: "Pasted two" },
          { op: "insert", after: blank, text: "Pasted three" },
          { op: "setText", handle: clear, text: "" },
        ],
      })
      const written = await page(owner, shown.doc)
      expect(written.paragraphs.map((paragraph) => paragraph.text)).toEqual([
        "Led ddata",
        "Hello there",
        "big world",
        "Join me to this",
        "Pasted one",
        "Pasted two",
        "Pasted three",
        "",
        "NameRole",
      ])
      expect(
        written.paragraphs.slice(0, 4).map((paragraph) => paragraph.handle)
      ).toEqual([led, hello, written.paragraphs[2]?.handle, join])
      const after = await bytesAt(owner, shown.doc, written.revision)
      const xml = loaded.mainXml(after)
      expect(xml).toContain(`${PLAIN}<w:t xml:space="preserve">Led d</w:t>`)
      expect(xml).toContain(`${BOLD}<w:t>data</w:t>`)
      expect(loaded.partsExceptMain(bytes, after)).toBe(true)
      const types = "[Content_Types].xml"
      expect((await packageMember(after, types))?.bytes).toEqual(
        (await packageMember(bytes, types))?.bytes
      )
      await registry().undo(owner, saved.activityId!)
      expect(await headOf(shown.doc)).toBe(shown.revision)
      expect(
        Buffer.from(await bytesAt(owner, shown.doc, shown.revision))
      ).toEqual(Buffer.from(bytes))
    }))

  it("refuses an old page and a held line with its own words, and writes nothing", () =>
    run(async () => {
      const owner = await seed()
      const { shown } = await importedPage(owner)
      const tabbed = shown.paragraphs.find((paragraph) => paragraph.held)
      if (!tabbed) throw new Error("missing held line")
      expect(tabbed.message).not.toBe("")
      await expect(
        write(owner, {
          doc: shown.doc,
          basedOn: shown.revision,
          ops: [
            { op: "setText", handle: handleOf(shown, "Clear me"), text: "Ok" },
            { op: "setText", handle: tabbed.handle, text: "Name Role" },
          ],
        })
      ).rejects.toThrow(tabbed.message)
      expect(await headOf(shown.doc)).toBe(shown.revision)
      await write(owner, {
        doc: shown.doc,
        basedOn: shown.revision,
        ops: [{ op: "setText", handle: handleOf(shown, "Clear me"), text: "" }],
      })
      const moved = await headOf(shown.doc)
      await expect(
        write(owner, {
          doc: shown.doc,
          basedOn: shown.revision,
          ops: [
            { op: "setText", handle: handleOf(shown, "Join me"), text: "Hi" },
          ],
        })
      ).rejects.toThrow(
        "This Word document has changed. Read it again before editing."
      )
      expect(await headOf(shown.doc)).toBe(moved)
    }))
})

describe("a blank page keeps the kind the person started", () => {
  it("labels a blank CV cv and a blank Letter letter, and names each file", () =>
    run(async () => {
      const owner = await seed()
      const mint = (input: unknown) =>
        registry().execute({
          name: "paper.canvas",
          input,
          actor: personActor(owner),
          idempotencyKey: randomUUID(),
        })
      const cv = (await mint({ op: "mint", label: "cv" })).output as {
        docId: string
        revision: string
      }
      const letter = (await mint({ op: "mint", label: "letter" })).output as {
        docId: string
        revision: string
      }
      expect(await page(owner, cv.docId)).toMatchObject({
        label: "cv",
        name: "CV",
      })
      expect(await page(owner, letter.docId)).toMatchObject({
        label: "letter",
        name: "Cover letter",
      })
      const file = await exportWord(owner, letter.docId, letter.revision)
      expect("bytes" in file && file.bytes.byteLength > 0).toBe(true)
      await expect(mint({ op: "mint" })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    }))
})
