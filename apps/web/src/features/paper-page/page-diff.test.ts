import { describe, expect, it } from "vitest"

import type { WordPage, WordParagraph } from "@workspace/domain/paper-doc"

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
        {
          op: "setText",
          handle: B,
          text: "Second line",
          caret: 11,
          lean: "before",
          keptBefore: 0,
        },
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
        {
          op: "setText",
          handle: A,
          text: "Join me to this",
          caret: 8,
          lean: "before",
          keptBefore: 0,
        },
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
      ops: [
        {
          op: "setText",
          handle: A,
          text: "Led ddata",
          caret: 5,
          lean: "before",
          keptBefore: 0,
        },
      ],
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
      ops: [
        {
          op: "setText",
          handle: A,
          text: "Your Name QA555",
          caret: 12,
          lean: "before",
          keptBefore: 1,
        },
      ],
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

describe("the side of a run boundary the caret sits on", () => {
  const linked = pageOf({
    handle: A,
    text: "Portfolio at  today",
    pieces: [
      { text: "Portfolio at ", editable: true },
      { text: "example site", editable: false, marks: ["link"] },
      { text: " today", editable: true },
    ],
    held: false,
    message: "",
    code: null,
  })

  const broken = pageOf({
    handle: A,
    text: "Marketing InternJun 2025",
    pieces: [
      { text: "Marketing Intern", editable: true },
      { text: "\n", editable: false },
      { text: "Jun 2025", editable: true },
    ],
    held: false,
    message: "",
    code: null,
  })

  function typedInto(page: WordPage, id: string, text: string) {
    return pageBlocks(page).map((block) =>
      block.id === id ? { ...block, text } : block
    )
  }

  it("leans after when the words open the text that follows a link", () => {
    expect(
      diffParagraphs(linked, typedInto(linked, `${A}#2`, "new today"), {
        blockId: `${A}#2`,
        offset: 3,
      })
    ).toEqual({
      ops: [
        {
          op: "setText",
          handle: A,
          text: "Portfolio at new today",
          caret: 16,
          lean: "after",
          keptBefore: 1,
        },
      ],
    })
  })

  it("leans before when the words close the text in front of a link", () => {
    expect(
      diffParagraphs(linked, typedInto(linked, `${A}#0`, "Portfolio at my"), {
        blockId: `${A}#0`,
        offset: 15,
      })
    ).toEqual({
      ops: [
        {
          op: "setText",
          handle: A,
          text: "Portfolio at my today",
          caret: 15,
          lean: "before",
          keptBefore: 0,
        },
      ],
    })
  })

  it("lets a person type on the far side of a soft line break", () => {
    expect(pageBlocks(broken)).toEqual([
      { id: `${A}#0`, text: "Marketing Intern" },
      { id: `${A}#1`, text: "\n", held: true },
      { id: `${A}#2`, text: "Jun 2025" },
    ])
    expect(
      diffParagraphs(broken, typedInto(broken, `${A}#2`, "Since Jun 2025"), {
        blockId: `${A}#2`,
        offset: 6,
      })
    ).toEqual({
      ops: [
        {
          op: "setText",
          handle: A,
          text: "Marketing InternSince Jun 2025",
          caret: 22,
          lean: "after",
          keptBefore: 1,
        },
      ],
    })
  })

  it("names no side when the caret sits in a line that did not change", () => {
    const blocks = typedInto(linked, `${A}#0`, "Portfolio at my")
    expect(
      diffParagraphs(linked, blocks, { blockId: `${A}#2`, offset: 0 })
    ).toEqual({
      ops: [
        {
          op: "setText",
          handle: A,
          text: "Portfolio at my today",
          caret: 15,
        },
      ],
    })
  })

  function lineOf(...pieces: WordParagraph["pieces"]): WordPage {
    return pageOf({
      handle: A,
      text: pieces
        .filter((piece) => piece.editable)
        .map((piece) => piece.text)
        .join(""),
      pieces,
      held: false,
      message: "",
      code: null,
    })
  }

  const site = { text: "example site", editable: false, marks: ["link"] }
  const second = { text: "second site", editable: false, marks: ["link"] }

  it("names the empty block before a link as the caret's own", () => {
    const page = lineOf({ text: "", editable: true }, site, {
      text: " today",
      editable: true,
    })
    expect(
      diffParagraphs(page, typedInto(page, `${A}#0`, "Hi "), {
        blockId: `${A}#0`,
        offset: 3,
      })
    ).toEqual({
      ops: [
        {
          op: "setText",
          handle: A,
          text: "Hi  today",
          caret: 3,
          lean: "after",
          keptBefore: 0,
        },
      ],
    })
  })

  it("names the empty block before a soft break as the caret's own", () => {
    const page = lineOf(
      { text: "", editable: true },
      { text: "\n", editable: false },
      { text: "Jun 2025", editable: true }
    )
    expect(
      diffParagraphs(page, typedInto(page, `${A}#0`, "Lead"), {
        blockId: `${A}#0`,
        offset: 4,
      })
    ).toMatchObject({ ops: [{ caret: 4, keptBefore: 0 }] })
  })

  it("names the empty block after a link as the caret's own", () => {
    const page = lineOf({ text: "Portfolio at ", editable: true }, site, {
      text: "",
      editable: true,
    })
    expect(
      diffParagraphs(page, typedInto(page, `${A}#2`, "now"), {
        blockId: `${A}#2`,
        offset: 3,
      })
    ).toMatchObject({ ops: [{ caret: 16, keptBefore: 1 }] })
  })

  it("names the empty block between two links as the caret's own", () => {
    const page = lineOf(
      { text: "A", editable: true },
      site,
      { text: "", editable: true },
      second,
      { text: "C", editable: true }
    )
    expect(
      diffParagraphs(page, typedInto(page, `${A}#2`, "x"), {
        blockId: `${A}#2`,
        offset: 1,
      })
    ).toMatchObject({ ops: [{ text: "AxC", caret: 2, keptBefore: 1 }] })
    expect(
      diffParagraphs(page, typedInto(page, `${A}#4`, "bC"), {
        blockId: `${A}#4`,
        offset: 1,
      })
    ).toMatchObject({
      ops: [{ text: "AbC", caret: 2, lean: "after", keptBefore: 2 }],
    })
  })

  it("names the caret's block when several letters arrive at once", () => {
    expect(
      diffParagraphs(linked, typedInto(linked, `${A}#2`, "and more today"), {
        blockId: `${A}#2`,
        offset: 8,
      })
    ).toMatchObject({ ops: [{ caret: 21, lean: "after", keptBefore: 1 }] })
  })

  it("names the caret's block when a letter after a link is deleted", () => {
    expect(
      diffParagraphs(linked, typedInto(linked, `${A}#2`, "today"), {
        blockId: `${A}#2`,
        offset: 0,
      })
    ).toMatchObject({ ops: [{ caret: 13, keptBefore: 1 }] })
  })

  it("holds no line the page says can change", () => {
    for (const page of [linked, broken])
      expect(pageBlocks(page).filter((block) => !block.held)).toHaveLength(2)
  })
})
