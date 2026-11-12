import { describe, expect, it } from "vitest"

import type { WritingDraft } from "./canvas-edit.ts"
import { changedLines } from "./canvas-merge.ts"
import { reduce, type CanvasAction, type CanvasState } from "./canvas-state.ts"

type Reducer = (state: CanvasState, action: CanvasAction) => CanvasState

function overwrittenLines(before: CanvasState, after: CanvasState): string[] {
  const now = new Map(after.present.blocks.map((block) => [block.id, block]))
  return changedLines(before.saved, before.present)
    .filter((block) => now.get(block.id)?.text !== block.text)
    .map((block) => block.id)
}

const SAVED_TEXT = "Available from June 2026"
const MINE = "Available from June 2026!"

function draft(texts: Record<string, string>): WritingDraft {
  return {
    blocks: Object.entries(texts).map(([id, text]) => ({ id, text })),
    caret: { blockId: "a", offset: 0 },
    nextId: 10,
  }
}

const saved = draft({ a: "Linh Nguyen", b: SAVED_TEXT })
const mine = draft({ a: "Linh Nguyen", b: MINE })
const elsewhere = draft({ a: "Linh Nguyen, MBA", b: "Available in June" })
const basis = { revision: "r1", words: "Linh Nguyen\nAvailable from June 2026" }
const moved = {
  revision: "r2",
  words: "Linh Nguyen, MBA\nAvailable in June",
}

function unsavedState(): CanvasState {
  return {
    past: [saved],
    present: mine,
    future: [],
    looks: new Map(),
    note: "",
    notice: "",
    basis,
    typed: true,
    saved,
    redraw: 0,
    unsaved: [{ id: "b", text: MINE, note: "This line mixes formatting." }],
    pageRefusal: null,
  }
}

const PERSON = "the person's own edit"
const DISCARD = "an explicit discard"

const ACTIONS: Record<
  CanvasAction["type"],
  typeof PERSON | typeof DISCARD | CanvasAction[]
> = {
  insert: PERSON,
  split: PERSON,
  delete: PERSON,
  paste: PERSON,
  composed: PERSON,
  undo: PERSON,
  redo: PERSON,
  useSaved: DISCARD,
  restoreLine: DISCARD,
  note: [{ type: "note", note: "Saved" }],
  notice: [{ type: "notice", notice: "This line mixes formatting." }],
  redraw: [{ type: "redraw" }],
  adopt: [{ type: "adopt", blocks: elsewhere.blocks }],
  basis: [
    { type: "basis", basis: moved, typed: false },
    { type: "basis", basis, typed: false },
  ],
  replace: [
    { type: "replace", draft: elsewhere, basis: moved },
    { type: "replace", draft: saved, basis },
  ],
  unsaved: [
    { type: "unsaved", lines: [], page: null, words: `Linh Nguyen\n${MINE}` },
    { type: "unsaved", page: "You are signed out.", words: "other" },
  ],
  keepMine: [
    { type: "keepMine", theirs: elsewhere, basis: moved },
    { type: "keepMine", theirs: saved, basis },
  ],
}

const SERVER_ACTIONS = Object.values(ACTIONS).flatMap((entry) =>
  Array.isArray(entry) ? entry : []
)

function restoringReducer(state: CanvasState, action: CanvasAction) {
  if (action.type === "unsaved" && state.saved)
    return { ...state, present: state.saved, redraw: state.redraw + 1 }
  return reduce(state, action)
}

function failures(reducer: Reducer) {
  return SERVER_ACTIONS.flatMap((action) => {
    const before = unsavedState()
    const lost = overwrittenLines(before, reducer(before, action))
    return lost.length > 0 ? [`${action.type}: ${lost.join(",")}`] : []
  })
}

describe("a line with unsaved words", () => {
  it("names every page action as the person's edit, a discard, or a server action with samples", () => {
    const named = Object.keys(ACTIONS).sort()
    expect(named.length).toBeGreaterThan(15)
    for (const entry of Object.values(ACTIONS)) {
      if (Array.isArray(entry)) expect(entry.length).toBeGreaterThan(0)
    }
  })

  it("keeps its words through every action that comes from the server", () => {
    expect(failures(reduce)).toEqual([])
  })

  it("is caught when a refusal puts back the saved page over it", () => {
    expect(failures(restoringReducer)).toContain("unsaved: b")
  })

  it("loses its words only through Use the saved page and Restore this line", () => {
    const before = unsavedState()
    expect(
      overwrittenLines(
        before,
        reduce(before, { type: "useSaved", theirs: elsewhere, basis: moved })
      )
    ).toEqual(["b"])
    expect(
      overwrittenLines(
        before,
        reduce(before, { type: "restoreLine", id: "b", text: SAVED_TEXT })
      )
    ).toEqual(["b"])
  })

  it("keeps my version and marks it when the same line changed elsewhere", () => {
    const after = reduce(unsavedState(), {
      type: "keepMine",
      theirs: elsewhere,
      basis: moved,
    })
    expect(after.present.blocks.map((block) => block.text)).toEqual([
      "Linh Nguyen, MBA",
      MINE,
    ])
    expect(after.unsaved.map((line) => line.id)).toEqual(["b"])
    expect(after.typed).toBe(true)
  })
})
