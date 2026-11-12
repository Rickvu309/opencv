import { describe, expect, it } from "vitest"

import type { WordPage, WordParagraph } from "@workspace/domain"

import { pageBlocks, type WritingBlock } from "./canvas-edit.ts"
import {
  collectLooks,
  drawnSegments,
  listMarkers,
  lookOf,
  withoutLooks,
} from "./canvas-look.ts"
import { pageWords } from "./canvas-save.ts"
import { diffParagraphs } from "./page-diff.ts"

const DOC = "11111111-1111-7111-8111-111111111111"
const REVISION = "22222222-2222-4222-8222-222222222222"
const NAME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const LEAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const LINK = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function formattedPage(): WordPage {
  return {
    doc: DOC,
    revision: REVISION,
    name: "CV.docx",
    label: "cv",
    paragraphs: [
      {
        handle: NAME,
        text: "Linh Nguyen",
        pieces: [{ text: "Linh Nguyen", editable: true }],
        held: false,
        message: "",
        code: null,
        form: { kind: "title" },
        align: "center",
      },
      {
        handle: LEAD,
        text: "Led data work",
        pieces: [
          { text: "Led ", editable: true },
          { text: "data", editable: true, marks: ["bold"] },
          { text: " work", editable: true },
        ],
        held: false,
        message: "",
        code: null,
        form: { kind: "bullet", level: 0 },
      },
      {
        handle: LINK,
        text: "Portfolio at ",
        pieces: [
          { text: "Portfolio at ", editable: true },
          { text: "example site", editable: false, marks: ["link"] },
        ],
        held: false,
        message: "",
        code: null,
      },
    ],
  }
}

function plainPage(page: WordPage): WordPage {
  return {
    ...page,
    paragraphs: page.paragraphs.map((paragraph): WordParagraph => ({
      handle: paragraph.handle,
      text: paragraph.text,
      pieces: paragraph.pieces.map((piece) => ({
        text: piece.text,
        editable: piece.editable,
      })),
      held: paragraph.held,
      message: paragraph.message,
      code: paragraph.code,
    })),
  }
}

function edited(blocks: readonly WritingBlock[], id: string, text: string) {
  return withoutLooks(blocks).map((block) =>
    block.id === id ? { ...block, text } : block
  )
}

describe("the page keeps the look of an imported line", () => {
  it("gives the page the same blocks and words, with the look beside them", () => {
    const formatted = pageBlocks(formattedPage())
    const plain = pageBlocks(plainPage(formattedPage()))
    expect(withoutLooks(formatted)).toEqual(plain)
    expect(pageWords(formatted)).toBe(pageWords(plain))
    expect(formatted.map((block) => block.look)).toEqual([
      { form: { kind: "title" }, align: "center" },
      {
        form: { kind: "bullet", level: 0 },
        spans: [{ from: 4, to: 8, marks: ["bold"] }],
      },
      undefined,
      { spans: [{ from: 0, to: 12, marks: ["link"] }] },
    ])
  })

  it("leaves a plain line without a look", () => {
    expect(
      lookOf([{ text: "plain", editable: true }], undefined, undefined)
    ).toBeUndefined()
  })

  it("sends the same batch for an edit in a bold-and-plain line as a plain page does", () => {
    const formatted = {
      ...formattedPage(),
      paragraphs: formattedPage().paragraphs.slice(0, 2),
    }
    const blocks = edited(pageBlocks(formatted), LEAD, "Led ddata work")
    const caret = { blockId: LEAD, offset: 5 }
    const withLook = diffParagraphs(formatted, blocks, caret)
    expect(withLook).toEqual(
      diffParagraphs(plainPage(formatted), blocks, caret)
    )
    expect(withLook).toEqual({
      ops: [{ op: "setText", handle: LEAD, text: "Led ddata work", caret: 5 }],
    })
  })

  it("keeps a letter typed after a plain word before a bold word plain", () => {
    const entry = {
      text: "Led data",
      look: { spans: [{ from: 4, to: 8, marks: ["bold" as const] }] },
    }
    expect(drawnSegments(entry, "Led ddata", 5)).toEqual([
      { text: "Led d", marks: [] },
      { text: "data", marks: ["bold"] },
    ])
  })

  it("keeps a letter typed inside a bold word bold", () => {
    const entry = {
      text: "Led data work",
      look: { spans: [{ from: 4, to: 8, marks: ["bold" as const] }] },
    }
    expect(drawnSegments(entry, "Led daXta work", 7)).toEqual([
      { text: "Led ", marks: [] },
      { text: "daXta", marks: ["bold"] },
      { text: " work", marks: [] },
    ])
    expect(drawnSegments(entry, "Led data", null)).toEqual([
      { text: "Led ", marks: [] },
      { text: "data", marks: ["bold"] },
    ])
  })

  it("numbers lists by level and starts again under a heading", () => {
    const forms = {
      a: { kind: "bullet", level: 0 },
      b: { kind: "bullet", level: 1 },
      c: { kind: "number", level: 0 },
      d: { kind: "number", level: 1 },
      e: { kind: "number", level: 1 },
      f: { kind: "number", level: 0 },
      g: { kind: "heading", level: 1 },
      h: { kind: "number", level: 0 },
    } as const
    const markers = listMarkers(
      Object.keys(forms).map((id) => ({ id })),
      (id) => forms[id as keyof typeof forms]
    )
    expect(Object.fromEntries(markers)).toEqual({
      a: "•",
      b: "◦",
      c: "1.",
      d: "a.",
      e: "b.",
      f: "2.",
      h: "1.",
    })
  })

  it("forgets a look the server no longer sends", () => {
    const book = collectLooks(new Map(), pageBlocks(formattedPage()))
    expect(book.get(LEAD)?.look.form).toEqual({ kind: "bullet", level: 0 })
    const after = collectLooks(book, [{ id: LEAD, text: "Led data work" }])
    expect(after.has(LEAD)).toBe(false)
    expect(collectLooks(after, [{ id: LEAD, text: "x" }])).toBe(after)
  })

  it("holds a line with a soft line break so an edit cannot move words across it", () => {
    const BREAK = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    const page: WordPage = {
      ...formattedPage(),
      paragraphs: [
        ...formattedPage().paragraphs.slice(0, 2),
        {
          handle: BREAK,
          text: "Marketing InternJun 2025 to now",
          pieces: [
            { text: "Marketing Intern", editable: true, marks: ["bold"] },
            { text: "\n", editable: false },
            { text: "Jun 2025 to now", editable: true },
          ],
          held: false,
          message: "",
          code: null,
        },
      ],
    }
    const blocks = pageBlocks(page)
    expect(blocks.at(-1)).toEqual({
      id: BREAK,
      text: "Marketing Intern\nJun 2025 to now",
      held: true,
      reason:
        "This line has a line break inside it. Paper shows it as it is but will not change it yet.",
      look: { spans: [{ from: 0, to: 16, marks: ["bold"] }] },
    })
    const plain = withoutLooks(blocks)
    expect(diffParagraphs(page, plain, null)).toEqual({ ops: [] })
    const movedWords = plain.map((block) =>
      block.id === BREAK
        ? { ...block, text: "Marketing Intern\nSince Jun 2025 to now" }
        : block
    )
    expect(diffParagraphs(page, movedWords, null)).toHaveProperty("refused")
    const elsewhere = plain.map((block) =>
      block.id === LEAD ? { ...block, text: "Led data work!" } : block
    )
    expect(diffParagraphs(page, elsewhere, null)).toEqual({
      ops: [{ op: "setText", handle: LEAD, text: "Led data work!" }],
    })
  })
})
