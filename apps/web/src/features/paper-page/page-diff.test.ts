import { describe, expect, it } from "vitest"

import type { WordPage, WordParagraph } from "@workspace/domain"

import {
  deleteBackward,
  draftFromPage,
  insertText,
  pageBlocks,
  pointSpan,
  splitParagraph,
  type WritingBlock,
} from "./canvas-edit.ts"
import { diffParagraphs } from "./page-diff.ts"

const A = "a11a11a1-a11a-4a11-8a11-a11a11a11a11"
const B = "b22b22b2-b22b-4b22-8b22-b22b22b22b22"
const C = "c33c33c3-c33c-4c33-8c33-c33c33c33c33"
const D = "d44d44d4-d44d-4d44-8d44-d44d44d44d44"

function line(handle: string, text: string): WordParagraph {
  return {
    handle,
    text,
    pieces: text === "" ? [] : [{ text, editable: true }],
    held: false,
    message: "",
    code: null,
  }
}

function held(handle: string, text: string, message: string): WordParagraph {
  return {
    handle,
    text,
    pieces: [{ text, editable: false }],
    held: true,
    message,
    code: "NOT_BODY",
  }
}

function pageOf(...paragraphs: WordParagraph[]): WordPage {
  return {
    doc: "11111111-1111-4111-8111-111111111111",
    revision: "22222222-2222-4222-8222-222222222222",
    name: "Page.docx",
    label: "cv",
    paragraphs,
  }
}

function texts(...blocks: [string, string][]): WritingBlock[] {
  return blocks.map(([id, text]) => ({ id, text }))
}

describe("diffParagraphs", () => {
  it("sends two changed lines as two setText operations", () => {
    const page = pageOf(line(A, "First"), line(B, "Second"))
    expect(
      diffParagraphs(page, texts([A, "First line"], [B, "Second line"]), {
        blockId: B,
        offset: 11,
      })
    ).toEqual({
      ops: [
        { op: "setText", handle: A, text: "First line" },
        { op: "setText", handle: B, text: "Second line", caret: 11 },
      ],
    })
  })

  it("sends a paste of three paragraphs as a setText and two inserts in order", () => {
    const page = pageOf(line(A, "Intro"), line(B, "End"))
    expect(
      diffParagraphs(
        page,
        texts([A, "Intro one"], ["p7", "two"], ["p8", "three"], [B, "End"]),
        null
      )
    ).toEqual({
      ops: [
        { op: "setText", handle: A, text: "Intro one" },
        { op: "insert", after: A, text: "two" },
        { op: "insert", after: A, text: "three" },
      ],
    })
  })

  it("sends a split with typing as the setText then the insert after it", () => {
    const page = pageOf(line(A, "Hello world"))
    expect(
      diffParagraphs(page, texts([A, "Hello there"], ["p2", "big world"]), {
        blockId: "p2",
        offset: 4,
      })
    ).toEqual({
      ops: [
        { op: "setText", handle: A, text: "Hello there" },
        { op: "insert", after: A, text: "big world" },
      ],
    })
  })

  it("sends a join as the setText then the delete of the next line", () => {
    const page = pageOf(line(A, "Join me"), line(B, "to this"), line(C, "Last"))
    expect(
      diffParagraphs(page, texts([A, "Join me to this"], [C, "Last"]), {
        blockId: A,
        offset: 8,
      })
    ).toEqual({
      ops: [
        { op: "setText", handle: A, text: "Join me to this", caret: 8 },
        { op: "delete", handle: B },
      ],
    })
  })

  it("sends a cleared line as setText to nothing, and a cleared page keeps one line", () => {
    const page = pageOf(line(A, "Keep"), line(B, "Clear me"))
    expect(diffParagraphs(page, texts([A, "Keep"], [B, ""]), null)).toEqual({
      ops: [{ op: "setText", handle: B, text: "" }],
    })
    expect(diffParagraphs(page, texts(["p3", ""]), null)).toEqual({
      ops: [
        { op: "setText", handle: A, text: "" },
        { op: "delete", handle: B },
      ],
    })
  })

  it("writes into a blank imported line and into a blank page that has no handle yet", () => {
    const page = pageOf(line(A, "Name"), line(B, ""))
    expect(
      diffParagraphs(page, texts([A, "Name"], [B, "Data analyst"]), null)
    ).toEqual({ ops: [{ op: "setText", handle: B, text: "Data analyst" }] })
    const blank = pageOf(line(A, ""))
    expect(
      diffParagraphs(blank, texts(["p1", "Dear Ada,"], ["p2", "Hello"]), null)
    ).toEqual({
      ops: [
        { op: "setText", handle: A, text: "Dear Ada," },
        { op: "insert", after: A, text: "Hello" },
      ],
    })
  })

  it("puts the caret where the letter was typed, so the module can keep its run", () => {
    const page = pageOf({
      ...line(A, "Led data"),
      pieces: [
        { text: "Led ", editable: true },
        { text: "data", editable: true },
      ],
    })
    expect(pageBlocks(page)).toEqual([{ id: A, text: "Led data" }])
    expect(
      diffParagraphs(page, texts([A, "Led ddata"]), { blockId: A, offset: 5 })
    ).toEqual({
      ops: [{ op: "setText", handle: A, text: "Led ddata", caret: 5 }],
    })
  })

  it("edits plain words beside a link or spelling mark as one line", () => {
    const page = pageOf(
      {
        handle: A,
        text: "Your Name555",
        pieces: [
          { text: "Name :", editable: false },
          { text: "Your Name", editable: true },
          { text: "MobileNo", editable: false },
          { text: "555", editable: true },
        ],
        held: false,
        message: "",
        code: null,
      },
      line(B, "Email: name@gmail.com")
    )
    const blocks = pageBlocks(page)
    expect(blocks).toEqual([
      { id: `${A}#0`, text: "Name :", held: true },
      { id: `${A}#1`, text: "Your Name" },
      { id: `${A}#2`, text: "MobileNo", held: true },
      { id: `${A}#3`, text: "555" },
      { id: B, text: "Email: name@gmail.com" },
    ])
    const typed = blocks.map((block) =>
      block.id === `${A}#1` ? { ...block, text: "Your Name QA" } : block
    )
    expect(
      diffParagraphs(page, typed, { blockId: `${A}#1`, offset: 12 })
    ).toEqual({
      ops: [{ op: "setText", handle: A, text: "Your Name QA555", caret: 12 }],
    })
    const email = blocks.map((block) =>
      block.id === B ? { ...block, text: "Email: name@gmail.com QA" } : block
    )
    expect(diffParagraphs(page, email, null)).toEqual({
      ops: [{ op: "setText", handle: B, text: "Email: name@gmail.com QA" }],
    })
  })

  it("holds a save that drops or changes a kept part, and a line moved between pieces", () => {
    const table = held(
      C,
      "Cell",
      "This line sits in a table or a box. Paper will not change it."
    )
    const page = pageOf(line(A, "Hello"), table, line(D, "End"))
    expect(
      diffParagraphs(page, texts([A, "Hello"], [D, "End"]), null)
    ).toHaveProperty("refused")
    const moved = pageOf({
      ...line(A, "ab"),
      pieces: [
        { text: "a", editable: true },
        { text: "link", editable: false },
        { text: "b", editable: true },
      ],
    })
    const blocks = pageBlocks(moved)
    expect(
      diffParagraphs(
        moved,
        [blocks[0]!, { id: "p9", text: "new" }, blocks[1]!, blocks[2]!],
        null
      )
    ).toHaveProperty("refused")
  })

  it("sends nothing when only the held line is unchanged", () => {
    const page = pageOf(line(A, "Hello"), held(B, "Cell", "Kept."))
    expect(diffParagraphs(page, pageBlocks(page), null)).toEqual({ ops: [] })
  })
})

describe("pageBlocks", () => {
  it("shows held lines with their message and keeps typing out of them", () => {
    const message =
      "This line sits in a table or a box. Paper will not change it."
    const page = pageOf(line(A, "Hello"), held(C, "Cell", message), line(D, ""))
    const draft = draftFromPage(page)
    expect(draft?.blocks).toEqual([
      { id: A, text: "Hello" },
      { id: C, text: "Cell", held: true, reason: message },
      { id: D, text: "" },
    ])
    expect(draft?.caret).toEqual({ blockId: A, offset: 0 })
    expect(draftFromPage(pageOf())).toBeNull()
    const at = pointSpan({ blockId: C, offset: 0 })
    expect(splitParagraph(draft!, at).blocks).toEqual(draft?.blocks)
    expect(insertText(draft!, at, "X").blocks[1]).toEqual(draft?.blocks[1])
    expect(
      deleteBackward(draft!, pointSpan({ blockId: A, offset: 0 })).blocks
    ).toEqual(draft?.blocks)
  })
})
