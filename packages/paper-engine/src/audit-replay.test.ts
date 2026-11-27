import { describe, expect, it } from "vitest"
import type { DocCommand, SelectionCommand } from "@workspace/domain/paper-doc"

import { documentText, selectionRange, type EditorState } from "./index.js"
import { newEngine, paperOf, person, textBlock } from "./engine.test-support.js"

type Key =
  | { label: string; select: SelectionCommand }
  | { label: string; type: string }
  | { label: string; enter: true }
  | { label: string; tab: 1 | -1 }
  | { label: string; bold: true }

const show = (text: string) => JSON.stringify(text)

function replay(
  name: string,
  blocks: ReturnType<typeof textBlock>[],
  keys: Key[]
) {
  const engine = newEngine()
  let state: EditorState = engine.load(paperOf(blocks), 0, "tab-1")
  const lines = [
    `${name}`,
    `  start: ${show(documentText(engine.read(state).doc))}`,
  ]
  for (const key of keys) {
    const { doc, selection } = engine.read(state)
    const range = selectionRange(doc, selection)
    const head = selection.kind === "text" ? selection.head : range.to
    let commands: DocCommand[] = []
    if ("select" in key) state = engine.select(state, key.select)
    if ("type" in key) commands = [{ op: "insertText", range, text: key.type }]
    if ("enter" in key)
      commands = [
        { op: "deleteRange", range },
        { op: "splitBlock", at: range.from },
      ]
    if ("tab" in key)
      commands = [{ op: "shiftLevel", blocks: [head.block], by: key.tab }]
    if ("bold" in key)
      commands = [{ op: "setMark", range, mark: { type: "bold" }, on: true }]
    if (commands.length) {
      const result = engine.run(state, commands, person)
      if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
      state = result.state
    }
    const after = engine.read(state).doc
    const lists = after.content
      .map((block) =>
        block.type === "text_block" && block.attrs.list
          ? `${block.attrs.list}@${block.attrs.level}`
          : "-"
      )
      .join(",")
    const bold = after.content
      .map((block) => {
        if (block.type !== "text_block") return "-"
        const runs = (block.content ?? []).filter((run) => run.type === "text")
        if (!runs.length) return "-"
        return runs.every((run) =>
          run.marks?.some((mark) => mark.type === "bold")
        )
          ? "B"
          : "plain"
      })
      .join(",")
    lines.push(
      `  ${key.label.padEnd(10)} -> ${show(documentText(after))} lists[${lists}] bold[${bold}]`
    )
  }
  console.log(lines.join("\n"))
  return engine.read(state).doc
}

const selectAll: Key = { label: "Ctrl+A", select: { op: "selectAll" } }
const end: Key = {
  label: "End",
  select: { op: "move", unit: "lineEdge", dir: 1, extend: false },
}
const right: Key = {
  label: "ArrowRight",
  select: { op: "move", unit: "char", dir: 1, extend: false },
}

describe("audit replay", () => {
  it("select all, End, Enter keeps every word", () => {
    const doc = replay(
      "select all, End, Enter",
      [
        textBlock("a", { text: "Alpha beta" }),
        textBlock("b", { text: "Gamma delta" }),
      ],
      [
        selectAll,
        end,
        { label: "Enter", enter: true },
        { label: "type x", type: "x" },
      ]
    )
    expect(documentText(doc)).toBe("Alpha beta\nGamma delta\nx")
  })

  it("select all, ArrowRight, z appends z and keeps every word", () => {
    const doc = replay(
      "select all, ArrowRight, z",
      [
        textBlock("a", { text: "Alpha beta" }),
        textBlock("b", { text: "Gamma delta" }),
      ],
      [selectAll, right, { label: "type z", type: "z" }]
    )
    expect(documentText(doc)).toBe("Alpha beta\nGamma deltaz")
  })

  it("three bullets then Tab nests the third", () => {
    const doc = replay(
      "three bullets then Tab",
      [textBlock("a", { list: "bullet" })],
      [
        { label: "type one", type: "one" },
        { label: "Enter", enter: true },
        { label: "type two", type: "two" },
        { label: "Enter", enter: true },
        { label: "type three", type: "three" },
        { label: "Tab", tab: 1 },
        { label: "Enter", enter: true },
        { label: "Enter", enter: true },
      ]
    )
    expect(documentText(doc)).toBe("one\ntwo\nthree\n")
    expect(
      doc.content.map(
        (block) =>
          block.type === "text_block" && [block.attrs.list, block.attrs.level]
      )
    ).toEqual([
      ["bullet", 0],
      ["bullet", 0],
      ["bullet", 1],
      [null, 0],
    ])
  })

  it("bold over three paragraphs bolds all three", () => {
    const doc = replay(
      "bold over three paragraphs",
      [
        textBlock("a", { text: "One" }),
        textBlock("b", { text: "Two" }),
        textBlock("c", { text: "Three" }),
      ],
      [selectAll, { label: "Ctrl+B", bold: true }]
    )
    for (const block of doc.content) {
      expect(block).toMatchObject({ content: [{ marks: [{ type: "bold" }] }] })
    }
  })
})

it("replays undo after paste and a table edit", () => {
  const engine = newEngine()
  const block = textBlock("page", { text: "Draft" })
  let state = engine.load(paperOf([block]), 0, person.client)
  const at = (offset: number) => ({ block: block.attrs.id, offset })
  const range = (offset: number) => ({ from: at(offset), to: at(offset) })
  const run = (command: DocCommand) => {
    const result = engine.run(state, [command], person)
    if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
    state = result.state
  }
  const undo = () => {
    const result = engine.undo(state)
    if (!result) throw new Error("Nothing to undo")
    state = result.state
  }
  const read = () => engine.read(state).doc
  run({ op: "insertText", range: range(5), text: " ready" })
  const typed = read()
  run({
    op: "pasteFragment",
    range: range(11),
    fragment: [{ type: "text", text: " for review" }],
  })
  const pasted = read()
  undo()
  const afterPasteUndo = read()
  expect(afterPasteUndo).toEqual(typed)
  run({ op: "insertTable", at: at(11), rows: 2, cols: 2 })
  const withTable = read()
  const table = withTable.content[1]
  if (table?.type !== "table") throw new Error("Expected a table")
  run({
    op: "editTable",
    block: table.attrs.id,
    row: 0,
    col: 0,
    action: "colRight",
  })
  const edited = read().content[1]
  if (edited?.type !== "table") throw new Error("Expected a table")
  expect(edited.attrs.columnsMpt).toHaveLength(3)
  undo()
  const afterTableUndo = read()
  expect(afterTableUndo).toEqual(withTable)
  const restored = afterTableUndo.content[1]
  if (restored?.type !== "table") throw new Error("Expected a table")
  console.log(
    [
      "paste and table undo",
      `  type       -> ${show(documentText(typed))}`,
      `  paste      -> ${show(documentText(pasted))}`,
      `  Undo       -> ${show(documentText(afterPasteUndo))}`,
      `  table edit -> ${edited.content.length} rows x ${edited.attrs.columnsMpt.length} columns`,
      `  Undo       -> ${restored.content.length} rows x ${restored.attrs.columnsMpt.length} columns (exact table restored)`,
    ].join("\n")
  )
})
