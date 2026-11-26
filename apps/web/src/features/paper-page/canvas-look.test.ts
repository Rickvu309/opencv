import { describe, expect, it } from "vitest"

import type { WordPage, WordParagraph } from "@workspace/domain/paper-doc"

import { pageBlocks, type WritingBlock } from "./canvas-edit.ts"
import {
  collectLooks,
  drawnSegments,
  listMarkers,
  lookOf,
  screenLooks,
  withoutLooks,
  type LookBook,
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

  it.each(["bold", "italic", "underline"] as const)(
    "carries trailing %s onto a new line before and after an empty save",
    (mark) => {
      const looks: LookBook = new Map([
        [
          LEAD,
          {
            text: "Lead tail",
            look: { spans: [{ from: 4, to: 9, marks: [mark] }] },
          },
        ],
      ])
      const shown = screenLooks(
        [
          { id: LEAD, text: "Lead tail" },
          { id: "p1", text: "Next" },
        ],
        looks,
        [{ id: LEAD }]
      )
      expect(drawnSegments(shown.get("p1"), "Next", 4)).toEqual([
        { text: "Next", marks: [mark] },
      ])
      const blank = lookOf(
        [{ text: "", editable: true, marks: [mark] }],
        undefined,
        undefined
      )
      expect(blank).toBeDefined()
      expect(drawnSegments({ text: "", look: blank ?? {} }, "Next", 4)).toEqual(
        [{ text: "Next", marks: [mark] }]
      )
    }
  )

  it("leaves a new line plain after a bold first run and a plain last run", () => {
    const looks: LookBook = new Map([
      [
        LEAD,
        {
          text: "Lead tail",
          look: { spans: [{ from: 0, to: 4, marks: ["bold"] }] },
        },
      ],
    ])
    const shown = screenLooks(
      [
        { id: LEAD, text: "Lead tail" },
        { id: "p1", text: "Next" },
      ],
      looks,
      [{ id: LEAD }]
    )
    expect(drawnSegments(shown.get("p1"), "Next", 4)).toEqual([
      { text: "Next", marks: [] },
    ])
  })

  it("leaves a plain line without a look", () => {
    expect(
      lookOf([{ text: "plain", editable: true }], undefined, undefined)
    ).toBeUndefined()
  })

  it("keeps a full replacement plain when no surrounding text remains", () => {
    expect(
      drawnSegments(
        {
          text: "Lead tail",
          look: { spans: [{ from: 0, to: 4, marks: ["bold"] }] },
        },
        "Next",
        4
      )
    ).toEqual([{ text: "Next", marks: [] }])
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
      ops: [
        {
          op: "setText",
          handle: LEAD,
          text: "Led ddata work",
          caret: 5,
          lean: "before",
          keptBefore: 0,
        },
      ],
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

  it("splits a line with a soft line break so either side can change", () => {
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
    expect(blocks.slice(-3)).toEqual([
      {
        id: `${BREAK}#0`,
        text: "Marketing Intern",
        look: { spans: [{ from: 0, to: 16, marks: ["bold"] }] },
      },
      { id: `${BREAK}#1`, text: "\n", held: true },
      { id: `${BREAK}#2`, text: "Jun 2025 to now" },
    ])
    const plain = withoutLooks(blocks)
    expect(diffParagraphs(page, plain, null)).toEqual({ ops: [] })
    const typed = plain.map((block) =>
      block.id === `${BREAK}#2`
        ? { ...block, text: "Since Jun 2025 to now" }
        : block
    )
    expect(
      diffParagraphs(page, typed, { blockId: `${BREAK}#2`, offset: 6 })
    ).toEqual({
      ops: [
        {
          op: "setText",
          handle: BREAK,
          text: "Marketing InternSince Jun 2025 to now",
          caret: 22,
          lean: "after",
          keptBefore: 1,
        },
      ],
    })
    const movedBreak = plain.map((block) =>
      block.id === `${BREAK}#1` ? { ...block, text: "\n\n" } : block
    )
    expect(diffParagraphs(page, movedBreak, null)).toHaveProperty("refused")
    const elsewhere = plain.map((block) =>
      block.id === LEAD ? { ...block, text: "Led data work!" } : block
    )
    expect(diffParagraphs(page, elsewhere, null)).toEqual({
      ops: [{ op: "setText", handle: LEAD, text: "Led data work!" }],
    })
  })
})

describe("the look the page draws for a line the server does not hold yet", () => {
  const book: LookBook = new Map([
    [NAME, { text: "Linh", look: { align: "center" } }],
    [LEAD, { text: "Lead", look: { form: { kind: "heading", level: 1 } } }],
  ])
  const saved = [{ id: NAME }, { id: LEAD }]
  const shown = (blocks: { id: string; text: string }[]) => {
    const looks = screenLooks(blocks, book, saved)
    return blocks.map((block) => looks.get(block.id)?.look ?? null)
  }

  it("takes the paragraph look and trailing marks of the saved line before it", () => {
    const marked: LookBook = new Map([
      [
        NAME,
        {
          text: "Linh",
          look: {
            align: "center",
            spans: [{ from: 0, to: 4, marks: ["bold"] }],
          },
        },
      ],
    ])
    const blocks = [
      { id: NAME, text: "Linh" },
      { id: "p7", text: "Intern" },
      { id: "p8", text: "Hanoi" },
    ]
    expect(
      blocks.map(
        (block) =>
          screenLooks(blocks, marked, [{ id: NAME }]).get(block.id)?.look
      )
    ).toEqual([
      { align: "center", spans: [{ from: 0, to: 4, marks: ["bold"] }] },
      { align: "center", spans: [{ from: 0, to: 6, marks: ["bold"] }] },
      { align: "center", spans: [{ from: 0, to: 5, marks: ["bold"] }] },
    ])
  })

  it("draws a line above every saved line plain, as the server inserts it with no look", () => {
    expect(
      shown([
        { id: "p3", text: "Top" },
        { id: NAME, text: "Linh" },
      ])
    ).toEqual([null, { align: "center" }])
  })

  it("draws a line the server deleted and Undo brought back with the look of the line before it", () => {
    expect(
      screenLooks(
        [
          { id: NAME, text: "Linh" },
          { id: LEAD, text: "Lead" },
        ],
        book,
        [{ id: NAME }]
      ).get(LEAD)?.look
    ).toEqual({ align: "center" })
  })

  it("draws new lines with the first saved line's look when every saved line was replaced", () => {
    expect(
      shown([
        { id: "p4", text: "New" },
        { id: "p5", text: "Also new" },
      ])
    ).toEqual([{ align: "center" }, { align: "center" }])
  })

  it("leaves the book untouched when every line is saved", () => {
    expect(
      screenLooks(
        [
          { id: NAME, text: "Linh" },
          { id: LEAD, text: "Lead" },
        ],
        book,
        saved
      )
    ).toBe(book)
  })
})
