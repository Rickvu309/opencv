import { describe, expect, it } from "vitest"
import type { DocCommand, Document } from "@workspace/domain/paper-doc"

import { documentText } from "./index.js"
import { newEngine, paperOf, person, textBlock } from "./engine.test-support.js"

const left = textBlock("left", { text: "Hello world" })
const right = textBlock("right", { text: "Goodbye world" })
const at = (offset: number, block = left.attrs.id) => ({ block, offset })

function edit(doc: Document, commands: DocCommand[]) {
  const engine = newEngine()
  const result = engine.run(
    engine.load(doc, 0, person.client),
    commands,
    person
  )
  if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
  return engine.read(result.state).doc
}

describe("paste", () => {
  it("keeps inline marks and preserves the text outside a backward range", () => {
    const doc = edit(paperOf([left]), [
      {
        op: "pasteFragment",
        range: { from: at(11), to: at(6) },
        fragment: [
          { type: "text", text: "friend", marks: [{ type: "italic" }] },
        ],
      },
    ])
    expect(doc.content).toEqual([
      textBlock("left", {
        runs: [
          { type: "text", text: "Hello " },
          { type: "text", text: "friend", marks: [{ type: "italic" }] },
        ],
      }),
    ])
  })

  it("inserts block fragments with fresh ids and keeps both untouched sides", () => {
    const doc = edit(paperOf([left, right]), [
      {
        op: "pasteFragment",
        range: { from: at(6), to: at(8, right.attrs.id) },
        fragment: [right, right],
      },
    ])
    expect(documentText(doc)).toBe(
      "Hello \nGoodbye world\nGoodbye world\nworld"
    )
    const ids = doc.content.map(({ attrs }) => attrs.id)
    expect(ids).toEqual(["left", "new-1", "new-2", "right"])
  })

  it("creates a fresh id for the right side when both sides share a source", () => {
    const doc = edit(paperOf([left]), [
      {
        op: "pasteFragment",
        range: { from: at(5), to: at(5) },
        fragment: [right],
      },
    ])
    expect(documentText(doc)).toBe("Hello\nGoodbye world\n world")
    expect(new Set(doc.content.map(({ attrs }) => attrs.id)).size).toBe(3)
  })
})

describe("tables", () => {
  it("preserves cell contents through row and column changes", () => {
    let doc = edit(paperOf([left]), [
      { op: "insertTable", at: at(11), rows: 2, cols: 2 },
    ])
    const table = doc.content[1]!
    const block = table.attrs.id
    const cell = { block, offset: 0, cell: { row: 0, col: 0 } }
    doc = edit(doc, [
      { op: "insertText", range: { from: cell, to: cell }, text: "kept" },
      { op: "editTable", block, row: 0, col: 0, action: "rowAbove" },
      { op: "editTable", block, row: 1, col: 0, action: "colLeft" },
      { op: "editTable", block, row: 2, col: 2, action: "deleteCol" },
      { op: "editTable", block, row: 2, col: 1, action: "deleteRow" },
    ])
    const after = doc.content[1]
    if (after?.type !== "table") throw new Error("Expected a table")
    expect(after.attrs.columnsMpt).toHaveLength(2)
    expect(after.content.map((row) => row.content)).toEqual([
      [{ type: "table_cell" }, { type: "table_cell" }],
      [
        { type: "table_cell" },
        { type: "table_cell", content: [{ type: "text", text: "kept" }] },
      ],
    ])
    doc = edit(doc, [
      { op: "editTable", block, row: 1, col: 1, action: "deleteTable" },
    ])
    expect(doc).toEqual(paperOf([left]))
  })
})

it("replaces literal matches across text runs and table cells while keeping the starting mark", () => {
  const marked = textBlock("left", {
    runs: [
      { type: "text", text: "X", marks: [{ type: "bold" }] },
      { type: "text", text: ". xz" },
    ],
  })
  let doc = edit(paperOf([marked]), [
    { op: "insertTable", at: at(5), rows: 1, cols: 1 },
  ])
  const cell = {
    block: doc.content[1]!.attrs.id,
    offset: 0,
    cell: { row: 0, col: 0 },
  }
  doc = edit(doc, [
    { op: "insertText", range: { from: cell, to: cell }, text: "x." },
    { op: "replaceAll", find: "x.", replace: "$1", matchCase: false },
  ])
  expect(doc.content[0]).toEqual(
    textBlock("left", {
      runs: [
        { type: "text", text: "$1", marks: [{ type: "bold" }] },
        { type: "text", text: " xz" },
      ],
    })
  )
  expect(doc.content[1]).toMatchObject({
    content: [{ content: [{ content: [{ type: "text", text: "$1" }] }] }],
  })
})
