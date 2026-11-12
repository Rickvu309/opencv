import { describe, expect, it } from "vitest"

import type { WritingDraft } from "./canvas-edit.ts"
import { reduce, type CanvasState } from "./canvas-state.ts"
import { savedPageSwap, unsavedBar } from "./canvas-unsaved.ts"

const H = (n: number) =>
  `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`

function draft(lines: [string, string][]): WritingDraft {
  return {
    blocks: lines.map(([id, text]) => ({ id, text })),
    caret: { blockId: lines[0]?.[0] ?? "p1", offset: 0 },
    nextId: 20,
  }
}

function changedElsewhere(
  saved: [string, string][],
  present: [string, string][],
  theirs: [string, string][]
): CanvasState {
  const words = (lines: [string, string][]) =>
    lines.map(([, text]) => text).join("\n")
  return {
    past: [],
    present: draft(present),
    future: [],
    looks: new Map(),
    note: "",
    notice: "",
    basis: { revision: "r1", words: words(saved) },
    typed: true,
    saved: draft(saved),
    redraw: 0,
    unsaved: [],
    pageRefusal: null,
    moved: {
      basis: { revision: "r2", words: words(theirs) },
      head: draft(theirs).blocks,
    },
  }
}

const ROWS: {
  name: string
  saved: [string, string][]
  present: [string, string][]
  theirs: [string, string][]
  discards: number
}[] = [
  {
    name: "a removed line that still has a temporary id, edited elsewhere",
    saved: [
      [H(1), "Linh"],
      ["p3", "Marketing Intern"],
    ],
    present: [[H(1), "Linh"]],
    theirs: [
      [H(1), "Linh, MBA"],
      [H(2), "Marketing Intern, Lumière"],
    ],
    discards: 1,
  },
  {
    name: "a removed line that still has a temporary id, unchanged elsewhere",
    saved: [
      [H(1), "Linh"],
      [H(12), "x"],
      ["p10", "fgjj"],
      [H(11), "end"],
    ],
    present: [
      [H(1), "Linh"],
      [H(12), "x"],
      [H(11), "end"],
    ],
    theirs: [
      [H(1), "Linh"],
      [H(17), "fgjj"],
      [H(11), "end~"],
    ],
    discards: 1,
  },
  {
    name: "a line added and never saved",
    saved: [[H(1), "Linh"]],
    present: [
      [H(1), "Linh"],
      ["p5", "New line"],
    ],
    theirs: [[H(1), "Linh, MBA"]],
    discards: 1,
  },
  {
    name: "a line added then edited",
    saved: [[H(1), "Linh"]],
    present: [
      [H(1), "Linh"],
      ["p5", "New line, edited"],
    ],
    theirs: [
      [H(1), "Linh"],
      [H(9), "Other"],
    ],
    discards: 1,
  },
  {
    name: "a line split from a saved line",
    saved: [[H(1), "Marketing Intern, Lumière"]],
    present: [
      [H(1), "Marketing Intern"],
      ["p6", ", Lumière"],
    ],
    theirs: [
      [H(1), "Marketing Intern, Lumière"],
      [H(9), "Other"],
    ],
    discards: 2,
  },
  {
    name: "two lines joined",
    saved: [
      [H(1), "Linh"],
      [H(2), "Nguyen"],
    ],
    present: [[H(1), "LinhNguyen"]],
    theirs: [
      [H(1), "Linh"],
      [H(2), "Nguyen"],
      [H(9), "Other"],
    ],
    discards: 2,
  },
  {
    name: "a removed line that had been saved",
    saved: [
      [H(1), "Linh"],
      [H(2), "Nguyen"],
    ],
    present: [[H(1), "Linh"]],
    theirs: [
      [H(1), "Linh, MBA"],
      [H(2), "Nguyen"],
    ],
    discards: 1,
  },
  {
    name: "a removed line also deleted elsewhere",
    saved: [
      [H(1), "Linh"],
      [H(2), "Nguyen"],
    ],
    present: [[H(1), "Linh!"]],
    theirs: [[H(1), "Linh"]],
    discards: 1,
  },
]

describe("Use the saved page counts exactly the unsaved lines it discards", () => {
  it.each(ROWS)("$name", ({ saved, present, theirs, discards }) => {
    const state = changedElsewhere(saved, present, theirs)
    const swap = savedPageSwap(state)
    expect(swap ? swap.lines.length + swap.removed.length : -1).toBe(discards)
    expect(unsavedBar(state).discards).toBe(discards)
    const after = reduce(state, { type: "useSaved" })
    expect(after.present.blocks.map((block) => block.text)).toEqual(
      theirs.map(([, text]) => text)
    )
    expect(after.moved).toBeNull()
  })
})
