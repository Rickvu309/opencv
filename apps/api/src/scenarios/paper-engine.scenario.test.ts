import {
  paperEngineBlank,
  type Document,
  type LayoutPage,
} from "@workspace/domain/paper-doc"
import {
  createEngine,
  createLayouter,
  fixedClock,
  paperFontMetrics,
  seededIds,
} from "@workspace/paper-engine"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createDemoCoachRuntime } from "../coach/index.js"
import { engineLog } from "../paper/engine-sync-log.js"
import { createPaperLog, postgresLogStore } from "../paper/log/index.js"
import {
  dataOf,
  failureOf,
  openWorld,
  type Person,
  type World,
} from "./person.test-support.js"
import {
  engineHelpers,
  importCorpus,
  importWord,
  at,
  span,
  texts,
} from "./paper-engine.test-support.js"
import { eq } from "drizzle-orm"
import { getDb } from "../db/context.js"
import { paperDocs } from "../db/schema.js"

let world: World
let paper: ReturnType<typeof engineHelpers>

beforeAll(async () => {
  world = await openWorld({ coach: createDemoCoachRuntime() })
  paper = engineHelpers()
})

afterAll(async () => {
  await world.close()
})

async function pdfPages(bytes: Buffer) {
  const unpdf = await import("unpdf")
  const pdf = await unpdf.getDocumentProxy(new Uint8Array(bytes))
  const { text } = await unpdf.extractText(pdf, { mergePages: false })
  return text
}

const editor = createEngine({
  ids: seededIds("scenario-edit"),
  now: fixedClock(),
})
const log = createPaperLog({ store: postgresLogStore, engine: editor })
const blank = paperEngineBlank.blankCv()

async function firstEnginePaper(owner: Person) {
  const id = await paper.blank(owner)
  await world.inside(() =>
    getDb()
      .update(paperDocs)
      .set({ engine: 1, snapshot: null })
      .where(eq(paperDocs.id, id))
  )
  return id
}

async function enginePaper(owner: Person) {
  const id = await paper.blank(owner)
  expect(await world.inside(() => log.start(id, blank))).toEqual({
    refusal: { code: "schema", detail: "This Paper already has a log" },
  })
  return id
}

function type(
  owner: Person,
  client: string,
  text: string,
  base = 0,
  offset = 0,
  doc = blank
) {
  const pos = { block: doc.content[0]!.attrs.id, offset }
  const result = editor.run(
    editor.load(doc, base, client),
    [{ op: "insertText", range: { from: pos, to: pos }, text }],
    { kind: "person", actor: owner.id, client }
  )
  if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
  return result.change
}

async function stored(docId: string) {
  const saved = await world.inside(() => log.head(docId))
  if (!("doc" in saved)) throw new Error(JSON.stringify(saved))
  return saved
}

describe("the Paper engine keeps its promises", () => {
  it("loses no text outside the range a command changes (#2207)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await paper.written(ada, [
      "Ada Lovelace",
      "Analyst",
      "Python",
    ])
    await paper.edit(ada, docId, [
      { op: "deleteRange", range: span(blocks[1]!.id, 0, 3) },
    ])
    expect(texts(await paper.outline(ada, docId))).toEqual([
      "Ada Lovelace",
      "lyst",
      "Python",
    ])
  })

  it("undoes a change exactly, back to the Paper before it (#2207)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await paper.written(ada, [
      "Ada Lovelace",
      "Analyst",
    ])
    const before = await paper.outline(ada, docId)
    const done = await paper.edit(ada, docId, [
      { op: "setBlockKind", blocks: [blocks[0]!.id], kind: "title" },
      {
        op: "insertText",
        range: span(blocks[1]!.id, 0, 7),
        text: "Engineer",
      },
      { op: "splitBlock", at: at(blocks[1]!.id, 3) },
    ])
    expect(done.ok).toBe(true)
    await paper.undo(ada, docId)
    expect((await paper.outline(ada, docId)).blocks).toEqual(before.blocks)
  })

  it("stores the steps a tab sent, so every replay gives the same Paper", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const tab = "tab-a"
    const origin = { kind: "person", actor: ada.id, client: tab } as const
    const block = blank.content[0]!.attrs.id
    const start = { block, offset: 0 }
    const first = editor.run(
      editor.load(blank, 0, tab),
      [
        {
          op: "insertText",
          range: { from: start, to: start },
          text: "Hello world",
        },
      ],
      origin
    )
    if ("refusal" in first) throw new Error(JSON.stringify(first.refusal))
    const split = editor.run(
      editor.load(editor.read(first.state).doc, first.change.steps.length, tab),
      [{ op: "splitBlock", at: { block, offset: 6 } }],
      origin
    )
    if ("refusal" in split) throw new Error(JSON.stringify(split.refusal))
    const changes = [first.change, split.change]
    const head = changes.flatMap((change) => change.steps).length
    const saved = await ada.run("paper.save", {
      docId,
      client: tab,
      base: 0,
      changes,
    })
    expect(saved.status).toBe(200)
    expect(dataOf(saved)).toEqual({ ok: true, head })
    expect(
      dataOf(await ada.read("paper.changes", { docId, since: 0 }))
    ).toEqual({
      head,
      changes,
    })
    expect(await stored(docId)).toEqual({
      version: head,
      doc: editor.read(split.state).doc,
    })
  })

  it("puts the same lines on the same pages on screen and in the PDF (#2207)", async () => {
    const ada = await world.person("Ada")
    const lines = Array.from(
      { length: 90 },
      (_, n) => `Line ${n + 1} of a long CV`
    )
    const { docId } = await paper.written(ada, lines)
    const laid = await paper.layout(ada, docId)
    const pdf = await paper.exported(ada, docId, "pdf")
    const pages = await pdfPages(pdf.bytes)
    expect(laid.pages.length).toBeGreaterThan(1)
    expect(pages).toHaveLength(laid.pages.length)
    laid.pages.forEach((page, index) => {
      expect(pages[index]).toContain(page.lines[0]!.text)
      expect(pages[index]).toContain(page.lines.at(-1)!.text)
    })
  })

  it("lays out only the Block a keystroke changed (#2207)", async () => {
    const ada = await world.person("Ada")
    const { docId, blocks } = await paper.written(ada, [
      "Ada Lovelace",
      "Analyst",
      "Python",
    ])
    const before = await paper.layout(ada, docId)
    await paper.edit(ada, docId, [
      { op: "insertText", range: span(blocks[1]!.id, 7, 7), text: "s" },
    ])
    const after = await paper.layout(ada, docId, before.version)
    expect(after.work.blocksLaidOut).toBe(1)
  })

  it.each([
    [
      "a step with an unknown node",
      [
        {
          stepType: "replace",
          from: 0,
          to: 0,
          slice: { content: [{ type: "unknown" }] },
        },
      ],
      "Unknown node type: unknown",
    ],
    [
      "a duplicate block id",
      [
        {
          stepType: "replace",
          from: 0,
          to: 0,
          slice: { content: blank.content },
        },
      ],
      "Block ids must be unique",
    ],
  ])("rolls back a batch containing %s", async (_label, steps, message) => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const first = type(ada, "tab-a", "Hello")
    const hostile = {
      ...type(ada, "tab-a", "Hi", 1),
      steps,
    }
    const result = failureOf(
      await ada.run("paper.save", {
        docId,
        client: "tab-a",
        base: 0,
        changes: [first, hostile],
      })
    )
    expect(result.code).toBe("schema")
    expect(result.message).toContain(message)
    expect(await stored(docId)).toEqual({ doc: blank, version: 0 })
    expect(
      dataOf(await ada.read("paper.changes", { docId, since: 0 }))
    ).toEqual({ head: 0, changes: [] })
  })
})

describe("only the owner's tabs write, in server order", () => {
  it("opens a new engine Paper at its head for its owner only", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const { id: docId } = dataOf<{ id: string }>(
      await ada.run("paper.create", { kind: "cv", format: "rich", engine: 2 })
    )
    const opened = dataOf<{ doc: Document; version: number }>(
      await ada.read("paper.head", { docId })
    )
    expect(opened.version).toBe(0)
    expect(opened.doc.content).toHaveLength(1)
    expect(JSON.stringify(opened.doc)).not.toContain("Kept")
    expect(failureOf(await grace.read("paper.head", { docId })).code).toBe(
      "NOT_FOUND"
    )
    const change = type(ada, "tab-a", "Kept", 0, 0, opened.doc)
    expect(
      dataOf(
        await ada.run("paper.save", {
          docId,
          client: "tab-a",
          base: 0,
          changes: [change],
        })
      )
    ).toEqual({ ok: true, head: 1 })
    const head = dataOf<{ doc: Document; version: number }>(
      await ada.read("paper.head", { docId })
    )
    expect(head.version).toBe(1)
    expect(JSON.stringify(head.doc)).toContain("Kept")
  })

  it("opens a new and an imported Paper on the new page", async () => {
    const ada = await world.person("Ada")
    const created = await paper.blank(ada)
    const imported = (await importCorpus(ada, "en-01")).docId
    for (const docId of [created, imported]) {
      expect(
        dataOf<{ format: string }>(
          await ada.read("paper.read", { docId, view: "info" })
        ).format
      ).toBe("rich")
      expect(
        dataOf<{ doc: { type: string } }>(
          await ada.read("paper.read", { docId, view: "engine" })
        ).doc.type
      ).toBe("doc")
    }
  })

  it("imports a PDF and a text file onto the new page with their headings", async () => {
    const ada = await world.person("Ada")
    const text = await importWord(
      ada,
      "cv.txt",
      new TextEncoder().encode(
        "Ada Lovelace\n\nExperience\nAnalyst at Halfwick Instruments\n- Built the engine model\n"
      )
    )
    const pdf = await importWord(
      ada,
      "cv.pdf",
      (
        await paper.exported(
          ada,
          (await importCorpus(ada, "en-01")).docId,
          "pdf"
        )
      ).bytes
    )
    expect(pdf.dropped).toEqual([
      "Imported the text of your PDF. Layout, fonts and photo were not kept.",
    ])
    const blocks = async (docId: string) =>
      dataOf<{
        doc: {
          content: {
            attrs: { kind: string; list: string | null }
            content?: { text: string }[]
          }[]
        }
      }>(await ada.read("paper.read", { docId, view: "engine" })).doc.content
    const textBlocks = await blocks(text.docId)
    expect(
      textBlocks.map((block) => [
        block.attrs.kind,
        block.attrs.list,
        block.content?.[0]?.text ?? "",
      ])
    ).toContainEqual(["heading", null, "Experience"])
    expect(JSON.stringify(textBlocks)).toContain("Built the engine model")
    const pdfBlocks = await blocks(pdf.docId)
    expect(
      pdfBlocks.map((block) => [block.attrs.kind, block.content?.[0]?.text])
    ).toContainEqual(["heading", "Profile"])
    expect(JSON.stringify(pdfBlocks)).toContain("Mira Vellstair")
    const changes = dataOf<{ changes: { origin: { kind: string } }[] }>(
      await ada.read("paper.changes", { docId: pdf.docId, since: 0 })
    )
    expect(changes.changes.map((change) => change.origin.kind)).toEqual([
      "import",
    ])
  })

  it("refuses access from another account and changes with a Coach origin", async () => {
    const ada = await world.person("Ada")
    const grace = await world.person("Grace")
    const docId = await enginePaper(ada)
    const change = type(ada, "tab-a", "Hi")
    const save = (person: Person, changes: unknown[]) =>
      person.run("paper.save", {
        docId,
        client: "tab-a",
        base: 0,
        changes,
      })
    expect(failureOf(await save(grace, [change])).code).toBe("NOT_FOUND")
    expect(
      failureOf(await grace.read("paper.changes", { docId, since: 0 })).code
    ).toBe("NOT_FOUND")
    expect(
      failureOf(
        await ada.read("paper.changes", {
          docId: await firstEnginePaper(ada),
          since: 0,
        })
      ).code
    ).toBe("NOT_FOUND")
    expect(
      failureOf(
        await save(ada, [
          {
            ...change,
            origin: { ...change.origin, kind: "coach" },
          },
        ])
      ).code
    ).toBe("schema")
    expect(await stored(docId)).toEqual({ doc: blank, version: 0 })
    expect(dataOf(await save(ada, [change]))).toEqual({ ok: true, head: 1 })
  })

  it("answers a push on an old version with the changes since and stores nothing", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const first = type(ada, "tab-a", "Analyst")
    dataOf(
      await ada.run("paper.save", {
        docId,
        client: "tab-a",
        base: 0,
        changes: [first],
      })
    )
    expect(
      dataOf(
        await ada.run("paper.save", {
          docId,
          client: "tab-b",
          base: 0,
          changes: [type(ada, "tab-b", "Data ")],
        })
      )
    ).toEqual({ stale: true, head: 1, since: [first] })
    expect(await stored(docId)).toMatchObject({
      version: 1,
      doc: { content: [{ content: [{ text: "Analyst" }] }] },
    })
  })

  it("accepts mapped steps after a stale reply and saves a resend once", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const initial = type(ada, "tab-a", "Analyst")
    const save = (change: typeof initial) =>
      ada.run("paper.save", {
        docId,
        client: change.origin.client,
        base: change.base,
        changes: [change],
      })
    expect(dataOf(await save(initial))).toEqual({ ok: true, head: 1 })
    const { doc } = await stored(docId)
    const first = type(ada, "tab-a", "Data ", 1, 0, doc)
    const second = type(ada, "tab-b", " today", 1, 7, doc)
    expect(dataOf(await save(first))).toEqual({ ok: true, head: 2 })
    expect(dataOf(await save(second))).toEqual({
      stale: true,
      head: 2,
      since: [first],
    })
    const state = editor.load(doc, 1, second.origin.client, [second])
    const { state: rebased } = editor.receive(state, [first])
    const [rebasedChange] = editor.sendable(rebased)
    expect(rebasedChange?.steps).not.toEqual(second.steps)
    expect(rebasedChange?.commands).toEqual(second.commands)
    expect(dataOf(await save(rebasedChange!))).toEqual({ ok: true, head: 3 })
    expect(dataOf(await save(first))).toEqual({ ok: true, head: 3 })
    expect(dataOf(await save(rebasedChange!))).toEqual({ ok: true, head: 3 })
    expect(await stored(docId)).toMatchObject({
      version: 3,
      doc: { content: [{ content: [{ text: "Data Analyst today" }] }] },
    })
  })

  it("saves a tab's Undo with no commands", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const client = "tab-a"
    const origin = { kind: "person", actor: ada.id, client } as const
    const pos = { block: blank.content[0]!.attrs.id, offset: 0 }
    const edit = editor.run(
      editor.load(blank, 0, client),
      [{ op: "insertText", range: { from: pos, to: pos }, text: "Draft" }],
      origin
    )
    if ("refusal" in edit) throw new Error(JSON.stringify(edit.refusal))
    const save = (change: typeof edit.change) =>
      ada.run("paper.save", {
        docId,
        client,
        base: change.base,
        changes: [change],
      })

    expect(dataOf(await save(edit.change))).toEqual({ ok: true, head: 1 })
    const confirmed = editor.receive(edit.state, [edit.change]).state
    const undone = editor.undo(confirmed)
    if (!undone || "refusal" in undone)
      throw new Error("Expected an Undo change")
    expect(undone.change.commands).toEqual([])
    expect(dataOf(await save(undone.change))).toEqual({ ok: true, head: 2 })
    expect(await stored(docId)).toEqual({ doc: blank, version: 2 })
    expect(
      dataOf(await ada.read("paper.changes", { docId, since: 1 }))
    ).toEqual({ head: 2, changes: [undone.change] })
  })

  it("a saved Paper's library card carries its real first page (#2248)", async () => {
    const ada = await world.person("Ada")
    const docId = await enginePaper(ada)
    const change = type(ada, "tab-a", "Ada Lovelace, engineer")
    expect(
      dataOf(
        await ada.run("paper.save", {
          docId,
          client: "tab-a",
          base: 0,
          changes: [change],
        })
      )
    ).toEqual({ ok: true, head: 1 })
    await world.inside(() => engineLog.flushFirstPage(docId))
    const listed = dataOf<{ id: string; firstPage?: LayoutPage }[]>(
      await ada.read("paper.list", {})
    )
    const { doc } = await stored(docId)
    const expected = createLayouter(paperFontMetrics).layout(doc, null)
      .pages[0]!
    expect(listed.find((row) => row.id === docId)?.firstPage).toEqual(
      JSON.parse(JSON.stringify(expected)) as LayoutPage
    )
  })
})
