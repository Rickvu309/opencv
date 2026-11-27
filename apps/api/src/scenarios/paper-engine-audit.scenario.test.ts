import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { openWorld, type World } from "./person.test-support.js"
import {
  engineHelpers,
  at,
  span,
  paragraph,
  texts,
  pdfPages,
} from "./paper-engine.test-support.js"

let world: World
let paper: ReturnType<typeof engineHelpers>

beforeAll(async () => {
  world = await openWorld()
  paper = engineHelpers(world)
})

afterAll(async () => {
  await world.close()
})

describe("the 2026-11-27 editor audit", () => {
  it.fails(
    "1: typing after select all and End adds to the end and keeps every line (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, [
        "Ada Lovelace",
        "Analyst",
      ])
      await paper.edit(ada, docId, [
        { op: "splitBlock", at: at(blocks[1]!.id, 7) },
      ])
      expect(texts(await paper.outline(ada, docId))).toEqual([
        "Ada Lovelace",
        "Analyst",
        "",
      ])
    }
  )

  it.fails(
    "2: Enter in a list continues it, and Tab nests the item (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, ["Python"])
      await paper.edit(ada, docId, [
        { op: "setList", blocks: [blocks[0]!.id], list: "bullet" },
      ])
      await paper.edit(ada, docId, [
        { op: "splitBlock", at: at(blocks[0]!.id, 6) },
      ])
      const listed = (await paper.outline(ada, docId)).blocks
      await paper.edit(ada, docId, [
        { op: "shiftLevel", blocks: [listed[1]!.id], by: 1 },
      ])
      expect((await paper.outline(ada, docId)).blocks).toMatchObject([
        { text: "Python", list: "bullet", level: 0 },
        { text: "", list: "bullet", level: 1 },
      ])
    }
  )

  it.fails(
    "3: rich paste keeps headings, lists, bold and links, one Block per line (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const docId = await paper.blank(ada)
      const first = (await paper.outline(ada, docId)).blocks[0]!
      await paper.edit(ada, docId, [
        {
          op: "pasteFragment",
          range: span(first.id, 0, 0),
          fragment: [
            paragraph("Experience", "heading"),
            {
              type: "text_block",
              attrs: { kind: "paragraph", list: "bullet", level: 0 },
              content: [
                { type: "text", text: "Led", marks: [{ type: "bold" }] },
                { type: "text", text: " the " },
                {
                  type: "text",
                  text: "portfolio",
                  marks: [
                    { type: "link", attrs: { href: "https://example.com" } },
                  ],
                },
              ],
            },
            paragraph("Second line"),
          ],
        },
      ])
      expect((await paper.outline(ada, docId)).blocks).toMatchObject([
        { kind: "heading", text: "Experience" },
        {
          list: "bullet",
          text: "Led the portfolio",
          marks: [
            { type: "bold", from: 0, to: 3 },
            { type: "link", from: 8, to: 17, href: "https://example.com" },
          ],
        },
        { kind: "paragraph", text: "Second line" },
      ])
    }
  )

  it.fails(
    "4: a blank CV is one empty paragraph with no header, laid out as one line (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const docId = await paper.blank(ada, "cv")
      expect((await paper.outline(ada, docId)).blocks).toMatchObject([
        { kind: "paragraph", list: null, level: 0, text: "", marks: [] },
      ])
      expect((await paper.layout(ada, docId)).pages).toMatchObject([
        { lines: [{ text: "" }] },
      ])
    }
  )

  it.fails(
    "5: a keystroke in a three page CV does not lay out the other pages again (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const lines = Array.from(
        { length: 130 },
        (_, n) => `Achievement ${n + 1}`
      )
      const { docId, blocks } = await paper.written(ada, lines)
      const before = await paper.layout(ada, docId)
      expect(before.pages.length).toBeGreaterThanOrEqual(3)
      await paper.edit(ada, docId, [
        { op: "insertText", range: span(blocks[60]!.id, 0, 0), text: "x" },
      ])
      const after = await paper.layout(ada, docId, before.version)
      expect(after.work).toEqual({ blocksLaidOut: 1, pagesPaginated: 1 })
    }
  )

  it.fails(
    "6: bold over three paragraphs bolds all three (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, [
        "One",
        "Two",
        "Three",
      ])
      await paper.edit(ada, docId, [
        {
          op: "setMark",
          range: { from: at(blocks[0]!.id, 0), to: at(blocks[2]!.id, 5) },
          mark: { type: "bold" },
          on: true,
        },
      ])
      expect(
        (await paper.outline(ada, docId)).blocks.map((block) => block.marks)
      ).toEqual([
        [{ type: "bold", from: 0, to: 3 }],
        [{ type: "bold", from: 0, to: 3 }],
        [{ type: "bold", from: 0, to: 5 }],
      ])
    }
  )

  it.fails("7: a Paper downloads as a PDF with its text (#2207)", async () => {
    const ada = await world.person("Ada")
    const { docId } = await paper.written(ada, [
      "Nguyễn Thị Lan",
      "Kỹ sư dữ liệu",
    ])
    const pdf = await paper.exported(ada, docId, "pdf")
    expect(pdf.contentType).toBe("application/pdf")
    expect((await pdfPages(pdf.bytes)).join("\n")).toContain("Nguyễn Thị Lan")
  })

  it.fails(
    "8: Word keeps heading levels and links on the way out (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const docId = await paper.blank(ada)
      const first = (await paper.outline(ada, docId)).blocks[0]!
      await paper.edit(ada, docId, [
        {
          op: "pasteFragment",
          range: span(first.id, 0, 0),
          fragment: [
            paragraph("Experience", "heading"),
            paragraph("Northwind", "subheading"),
            {
              type: "text_block",
              attrs: { kind: "paragraph", list: null, level: 0 },
              content: [
                {
                  type: "text",
                  text: "portfolio",
                  marks: [
                    { type: "link", attrs: { href: "https://example.com" } },
                  ],
                },
              ],
            },
          ],
        },
      ])
      const word = await paper.exported(ada, docId, "docx")
      const loaded = (await import("mammoth")) as unknown as {
        default?: {
          convertToHtml: (input: {
            buffer: Buffer
          }) => Promise<{ value: string }>
        }
        convertToHtml: (input: { buffer: Buffer }) => Promise<{ value: string }>
      }
      const mammoth = loaded.default ?? loaded
      const { value } = await mammoth.convertToHtml({ buffer: word.bytes })
      expect(value).toContain("<h1>Experience</h1>")
      expect(value).toContain("<h2>Northwind</h2>")
      expect(value).toContain('<a href="https://example.com">portfolio</a>')
    }
  )

  it.fails("10: a new Paper is an A4 page (#2207)", async () => {
    const ada = await world.person("Ada")
    const docId = await paper.blank(ada, "letter")
    expect((await paper.outline(ada, docId)).page).toEqual({
      size: "A4",
      orientation: "portrait",
    })
  })

  it.fails(
    "10: a link keeps its address when its text changes (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, ["portfolio"])
      await paper.edit(ada, docId, [
        {
          op: "setLink",
          range: span(blocks[0]!.id, 0, 9),
          href: "https://example.com",
        },
      ])
      await paper.edit(ada, docId, [
        { op: "insertText", range: span(blocks[0]!.id, 9, 9), text: " site" },
      ])
      expect((await paper.outline(ada, docId)).blocks[0]!.marks).toEqual([
        { type: "link", from: 0, to: 9, href: "https://example.com" },
      ])
    }
  )

  it.fails(
    "also: undo after paste takes back only the paste (#2207)",
    async () => {
      const ada = await world.person("Ada")
      const { docId, blocks } = await paper.written(ada, ["Summary"])
      await paper.edit(ada, docId, [
        {
          op: "insertText",
          range: span(blocks[0]!.id, 7, 7),
          text: " of my work.",
        },
      ])
      const pasted = await paper.edit(ada, docId, [
        {
          op: "pasteFragment",
          range: span(blocks[0]!.id, 19, 19),
          fragment: [{ type: "text", text: " Pasted." }],
        },
      ])
      expect((await ada.undo(pasted.activityId)).status).toBe(200)
      expect(texts(await paper.outline(ada, docId))).toEqual([
        "Summary of my work.",
      ])
    }
  )
})
