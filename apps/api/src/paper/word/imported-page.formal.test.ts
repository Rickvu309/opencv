import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

import {
  type WordCommit,
  type WordPage,
  type WordParagraph,
  type WordRefusal,
} from "@workspace/domain/paper-doc"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { getDb, withDatabase } from "../../db/context.js"
import { paperPackageHeads, user } from "../../db/schema.js"
import {
  openBackend,
  type Backend,
} from "../../test/registry-formal-support.js"
import { cvPackage } from "../package-fixtures.js"
import { publishWordPackage, stageWordPackage } from "../package-store.js"
import { apply, exportWord, open, undo } from "./document.js"

const loaded = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
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

function refused(value: WordCommit | WordRefusal): WordRefusal {
  if (!value.refused) throw new Error("expected a refusal")
  return value
}

async function imported(owner: string, body: string) {
  return importedBytes(owner, loaded.packageFromBody(body + SECTION))
}

async function importedBytes(owner: string, bytes: Uint8Array) {
  const stage = await stageWordPackage(
    owner,
    { requestId: randomUUID(), name: "Imported.docx", kind: "letter" },
    bytes
  )
  const published = await publishWordPackage(owner, stage.stageId)
  return pageOf(await open(owner, { kind: "read", doc: published.docId }))
}

function named(page: WordPage, text: string): WordParagraph {
  const found = page.paragraphs.find((paragraph) => paragraph.text === text)
  if (!found) throw new Error(`missing paragraph ${text}`)
  return found
}

async function xmlAt(owner: string, page: WordPage) {
  const file = await exportWord(owner, page.doc, page.revision)
  if ("refused" in file) throw new Error(file.message)
  return loaded.mainXml(file.bytes)
}

async function unchanged(owner: string, page: WordPage) {
  const [head] = await getDb()
    .select({
      revision: paperPackageHeads.revision,
      canvasProfile: paperPackageHeads.canvasProfile,
    })
    .from(paperPackageHeads)
    .where(eq(paperPackageHeads.docId, page.doc))
  expect(head?.revision).toBe(page.revision)
  expect(head?.canvasProfile).toBeNull()
}

describe("one classifier for imported pages", () => {
  it("saves a typed line on an imported page and undoes it", () =>
    run(async () => {
      const owner = await seed()
      const page = await imported(
        owner,
        line(piece("Dear team,")) + line(piece("Thanks"))
      )
      const target = named(page, "Dear team,")
      expect(target.held).toBe(false)
      const wrote = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [
            { op: "setText", handle: target.handle, text: "Dear hiring team," },
          ],
        })
      )
      expect(wrote.page.paragraphs.map((item) => item.text)).toEqual([
        "Dear hiring team,",
        "Thanks",
      ])
      expect(wrote.page.paragraphs[0]?.handle).toBe(target.handle)
      expect(await xmlAt(owner, wrote.page)).toContain(
        `${PLAIN}<w:t>Dear hiring team,</w:t>`
      )
      if (!wrote.undo) throw new Error("missing undo")
      const restored = saved(await undo(owner, wrote.undo))
      expect(restored.page.revision).toBe(page.revision)
      expect(restored.page.paragraphs[0]?.text).toBe("Dear team,")
    }))

  it("rewrites an imported line made of several plain runs", () =>
    run(async () => {
      const owner = await seed()
      const page = await imported(owner, line(piece("Hello "), piece("world")))
      const target = named(page, "Hello world")
      expect(target.held).toBe(false)
      expect(target.pieces).toEqual([{ text: "Hello world", editable: true }])
      const wrote = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [{ op: "setText", handle: target.handle, text: "Goodbye moon" }],
        })
      )
      expect(wrote.page.paragraphs[0]?.text).toBe("Goodbye moon")
      const xml = await xmlAt(owner, wrote.page)
      expect(xml).toContain(
        `<w:r>${PLAIN}<w:t xml:space="preserve">Goodbye moon</w:t></w:r><w:r>${PLAIN}<w:t></w:t></w:r>`
      )
      expect(xml).not.toContain("world")
    }))

  it("edits one piece of a line that mixes bold and plain words", () =>
    run(async () => {
      const owner = await seed()
      const page = await imported(
        owner,
        line(piece("Led the "), piece("data", BOLD), piece(" team"))
      )
      const target = named(page, "Led the data team")
      expect(target.held).toBe(false)
      expect(target.pieces.map((item) => item.text)).toEqual([
        "Led the ",
        "data",
        " team",
      ])
      const wrote = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [
            {
              op: "setText",
              handle: target.handle,
              text: "Led the data platform team",
            },
          ],
        })
      )
      expect(wrote.page.paragraphs[0]?.text).toBe("Led the data platform team")
      const xml = await xmlAt(owner, wrote.page)
      expect(xml).toContain(`${BOLD}<w:t>data</w:t>`)
      expect(xml).toContain(
        `${PLAIN}<w:t xml:space="preserve"> platform team</w:t>`
      )
    }))

  it("puts letters typed where a plain word meets a bold run into the plain run", () =>
    run(async () => {
      const owner = await seed()
      const page = await imported(
        owner,
        line(piece("Led "), piece("data", BOLD))
      )
      const target = named(page, "Led data")
      const wrote = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [{ op: "setText", handle: target.handle, text: "Led big data" }],
        })
      )
      const xml = await xmlAt(owner, wrote.page)
      expect(xml).toContain(`${PLAIN}<w:t xml:space="preserve">Led big </w:t>`)
      expect(xml).toContain(`${BOLD}<w:t>data</w:t>`)
    }))

  it("holds a rewrite that would flatten bold words and names why", () =>
    run(async () => {
      const owner = await seed()
      const page = await imported(
        owner,
        line(piece("Led the "), piece("data", BOLD), piece(" team"))
      )
      const target = named(page, "Led the data team")
      const before = await xmlAt(owner, page)
      const held = refused(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [
            { op: "setText", handle: target.handle, text: "Ran the group" },
          ],
        })
      )
      expect(held.reason).toBe("held")
      expect(held.code).toBe("MIXED_FORMAT")
      expect(held.handle).toBe(target.handle)
      expect(held.message).toContain("formatting")
      await unchanged(owner, page)
      expect(await xmlAt(owner, page)).toBe(before)
    }))

  it("keeps marked, sectioned, boxed-table and hidden-markup lines held", () =>
    run(async () => {
      const owner = await seed()
      const cases = [
        {
          code: "CHANGE_MARK",
          body: `<w:p><w:pPr><w:pPrChange w:id="2" w:author="A" w:date="2020-01-01T00:00:00Z"><w:pPr/></w:pPrChange></w:pPr>${piece("Item")}</w:p>`,
        },
        {
          code: "CHANGE_MARK",
          body: line(
            '<w:r><w:rPr><w:rPrChange w:id="1" w:author="A" w:date="2020-01-01T00:00:00Z"><w:rPr/></w:rPrChange></w:rPr><w:t>Item</w:t></w:r>'
          ),
        },
        {
          code: "SECTION",
          body: `<w:p><w:pPr><w:sectPr/></w:pPr>${piece("Item")}</w:p>`,
        },
        {
          code: "NOT_BODY",
          body: `<w:tbl><w:tr><w:tc>${line(piece("Item"))}${line(piece("Other"))}</w:tc></w:tr></w:tbl>`,
        },
        {
          code: "HIDDEN_MARKUP",
          body: line("<w:r><w:t>It<!--x-->em</w:t></w:r>"),
        },
        {
          code: "WORD_FEATURE",
          body: line(piece("It"), "<w:r><w:tab/></w:r>", piece("em")),
        },
      ]
      for (const { code, body } of cases) {
        const page = await imported(owner, body)
        const target = named(page, "Item")
        expect({ code: target.code, held: target.held }).toEqual({
          code,
          held: true,
        })
        expect(target.message.length).toBeGreaterThan(0)
        expect(target.pieces.every((item) => !item.editable)).toBe(true)
        const before = await xmlAt(owner, page)
        const held = refused(
          await apply(owner, {
            doc: page.doc,
            basedOn: page.revision,
            ops: [{ op: "setText", handle: target.handle, text: "Other" }],
          })
        )
        expect({ reason: held.reason, code: held.code }).toEqual({
          reason: "held",
          code,
        })
        expect(held.message).toBe(target.message)
        await unchanged(owner, page)
        expect(await xmlAt(owner, page)).toBe(before)
      }
    }))

  it("changes the words of numbered, linked, broken, proofed and table lines and holds their structure", () =>
    run(async () => {
      const owner = await seed()
      const link =
        '<w:hyperlink r:id="link"><w:r><w:rPr><w:color w:val="0563C1"/></w:rPr><w:t>site</w:t></w:r></w:hyperlink>'
      const cases = [
        {
          code: "NUMBERING",
          body: `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${piece("Led a team")}</w:p>`,
          text: "Led a team",
          next: "Led a sales team",
          kept: '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>',
        },
        {
          code: "WORD_FEATURE",
          body: line(piece("Visit "), link, piece(" today")),
          text: "Visit  today",
          next: "See  today",
          kept: link,
        },
        {
          code: "WORD_FEATURE",
          body: line(piece("First"), "<w:r><w:br/></w:r>", piece("Second")),
          text: "FirstSecond",
          next: "FirstThird",
          kept: "<w:r><w:br/></w:r>",
        },
        {
          code: "WORD_FEATURE",
          body: line(
            '<w:proofErr w:type="spellStart"/>',
            piece("Teh"),
            '<w:proofErr w:type="spellEnd"/>',
            piece(" plan")
          ),
          text: "Teh plan",
          next: "The plan",
          kept: '<w:proofErr w:type="spellEnd"/>',
        },
        {
          code: "NOT_BODY",
          body: `<w:tbl><w:tr><w:tc><w:tcPr/>${line(piece("Cell"))}</w:tc></w:tr></w:tbl>`,
          text: "Cell",
          next: "Table cell",
          kept: "<w:tc><w:tcPr/><w:p>",
        },
      ]
      for (const item of cases) {
        const page = await importedBytes(
          owner,
          cvPackage(item.body + line(piece("")))
        )
        const target = named(page, item.text)
        expect({ held: target.held, code: target.code }).toEqual({
          held: false,
          code: null,
        })
        const wrote = saved(
          await apply(owner, {
            doc: page.doc,
            basedOn: page.revision,
            ops: [{ op: "setText", handle: target.handle, text: item.next }],
          })
        )
        expect(wrote.page.paragraphs[0]?.text).toBe(item.next)
        expect(await xmlAt(owner, wrote.page)).toContain(item.kept)
        const later = wrote.page.paragraphs[0]
        if (!later) throw new Error("missing line")
        for (const ops of [
          [
            { op: "setText" as const, handle: later.handle, text: "Le" },
            {
              op: "insert" as const,
              after: later.handle,
              text: item.next.slice(2),
            },
          ],
          [{ op: "delete" as const, handle: later.handle }],
        ]) {
          const held = refused(
            await apply(owner, {
              doc: page.doc,
              basedOn: wrote.page.revision,
              ops: ops.map((op) =>
                op.op === "setText"
                  ? { ...op, text: item.next.slice(0, 2) }
                  : op
              ),
            })
          )
          expect({ reason: held.reason, code: held.code }).toEqual({
            reason: "held",
            code: item.code,
          })
          expect(held.message).toContain("will not split, join or remove")
        }
      }
    }))

  it("splits, joins and removes imported lines and keeps every other part", () =>
    run(async () => {
      const owner = await seed()
      const page = await imported(
        owner,
        line(piece("Hello "), piece("world", BOLD)) + line(piece(""))
      )
      const target = named(page, "Hello world")
      const empty = named(page, "")
      const original = await exportWord(owner, page.doc, page.revision)
      if ("refused" in original) throw new Error(original.message)
      const split = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [
            { op: "setText", handle: target.handle, text: "Hello wo" },
            { op: "insert", after: target.handle, text: "rld" },
          ],
        })
      )
      expect(split.page.paragraphs.map((item) => item.text)).toEqual([
        "Hello wo",
        "rld",
        "",
      ])
      const splitXml = await xmlAt(owner, split.page)
      expect(splitXml).toContain(`${BOLD}<w:t>wo</w:t>`)
      expect(splitXml).toContain(`${BOLD}<w:t>rld</w:t>`)
      const [left, right] = split.page.paragraphs
      if (!left || !right) throw new Error("missing split lines")
      const joined = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: split.page.revision,
          ops: [
            { op: "setText", handle: left.handle, text: "Hello world" },
            { op: "delete", handle: right.handle },
          ],
        })
      )
      expect(joined.page.paragraphs.map((item) => item.text)).toEqual([
        "Hello world",
        "",
      ])
      expect(joined.page.paragraphs[1]?.handle).toBe(empty.handle)
      const removed = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: joined.page.revision,
          ops: [{ op: "delete", handle: empty.handle }],
        })
      )
      expect(removed.page.paragraphs.map((item) => item.text)).toEqual([
        "Hello world",
      ])
      const file = await exportWord(owner, page.doc, removed.page.revision)
      if ("refused" in file) throw new Error(file.message)
      expect(loaded.partsExceptMain(original.bytes, file.bytes)).toBe(true)
      expect(loaded.mainXml(file.bytes)).toContain(SECTION)
      const kept = refused(
        await apply(owner, {
          doc: page.doc,
          basedOn: removed.page.revision,
          ops: [
            {
              op: "delete",
              handle: removed.page.paragraphs[0]?.handle ?? "",
            },
          ],
        })
      )
      expect({ reason: kept.reason, code: kept.code }).toEqual({
        reason: "order",
        code: "LAST_PARAGRAPH",
      })
    }))

  it("edits a line beside a text box and keeps the box held", () =>
    run(async () => {
      const owner = await seed()
      const box = `<w:p><w:r><w:pict><w:txbxContent>${line(piece("Boxed"))}</w:txbxContent></w:pict></w:r></w:p>`
      const page = await imported(owner, box + line(piece("Free")))
      const boxed = named(page, "Boxed")
      expect({ held: boxed.held, code: boxed.code }).toEqual({
        held: true,
        code: "NOT_BODY",
      })
      const target = named(page, "Free")
      const wrote = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [{ op: "setText", handle: target.handle, text: "Freed" }],
        })
      )
      expect(wrote.page.paragraphs.map((item) => item.text)).toEqual(
        page.paragraphs.map((item) =>
          item.text === "Free" ? "Freed" : item.text
        )
      )
      const xml = await xmlAt(owner, wrote.page)
      expect(xml).toContain(box)
    }))

  it("puts the first words on an empty imported line", () =>
    run(async () => {
      const owner = await seed()
      const page = await imported(owner, line(piece("")))
      const target = named(page, "")
      const wrote = saved(
        await apply(owner, {
          doc: page.doc,
          basedOn: page.revision,
          ops: [{ op: "setText", handle: target.handle, text: "Hi" }],
        })
      )
      expect(wrote.page.paragraphs.map((item) => item.text)).toEqual(["Hi"])
      expect(await xmlAt(owner, wrote.page)).toContain(`${PLAIN}<w:t>Hi</w:t>`)
    }))
})
