import { describe, expect, it } from "vitest"

import type { WritingDraft } from "./canvas-edit.ts"
import { pageWords } from "./canvas-save.ts"
import type { SaveOutcome } from "./canvas-save-outcome.ts"
import { reduce, type CanvasAction, type CanvasState } from "./canvas-state.ts"
import { changedLines } from "./canvas-unsaved.ts"

type Reducer = (state: CanvasState, action: CanvasAction) => CanvasState

function overwrittenLines(before: CanvasState, after: CanvasState): string[] {
  const changed = new Set(changedLines(before.saved, before.present))
  return before.present.blocks.flatMap((block, index) =>
    changed.has(block) && after.present.blocks[index]?.text !== block.text
      ? [block.id]
      : []
  )
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

function unsavedState(known = true): CanvasState {
  return {
    past: [saved],
    present: mine,
    future: [],
    looks: new Map(),
    note: "",
    notice: "",
    basis,
    typed: true,
    saved: known ? saved : null,
    redraw: 0,
    unsaved: [{ id: "b", text: MINE, note: "This line mixes formatting." }],
    pageRefusal: null,
    moved: null,
  }
}

const WORDS = `Linh Nguyen\n${MINE}`

function settle(outcome: Partial<SaveOutcome>): CanvasAction {
  return {
    type: "settled",
    outcome: {
      saved: false,
      words: WORDS,
      revision: null,
      note: null,
      ...outcome,
    },
    words: WORDS,
    typed: true,
  }
}

const OUTCOMES: Partial<SaveOutcome>[] = [
  {},
  { note: "This line mixes formatting." },
  { conflict: true, moved: { basis: moved, head: elsewhere.blocks } },
  { replace: elsewhere, basis: moved },
  { replace: saved, basis },
  { basis, head: saved.blocks, refusedLines: [] },
  { basis: moved, head: elsewhere.blocks },
  { refusedLines: [], pageRefusal: "You are signed out." },
  { saved: true, basis, head: saved.blocks },
  { renamed: { b: "c" }, basis, head: saved.blocks },
]

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
  settled: OUTCOMES.map(settle),
}

const SERVER_ACTIONS = Object.values(ACTIONS).flatMap((entry) =>
  Array.isArray(entry) ? entry : []
)

function restoringReducer(state: CanvasState, action: CanvasAction) {
  if (action.type === "settled" && action.outcome.refusedLines && state.saved)
    return { ...state, present: state.saved, redraw: state.redraw + 1 }
  return reduce(state, action)
}

function failures(reducer: Reducer) {
  return SERVER_ACTIONS.flatMap((action) => {
    return [unsavedState(), unsavedState(false)].flatMap((before) => {
      const lost = overwrittenLines(before, reducer(before, action))
      return lost.length > 0 ? [`${action.type}: ${lost.join(",")}`] : []
    })
  })
}

describe("a line with unsaved words", () => {
  it("names every page action as the person's edit, a discard, or a server action with samples", () => {
    const named = Object.keys(ACTIONS).sort()
    expect(named).toEqual([
      "composed",
      "delete",
      "insert",
      "note",
      "notice",
      "paste",
      "redo",
      "redraw",
      "restoreLine",
      "settled",
      "split",
      "undo",
      "useSaved",
    ])
    for (const entry of Object.values(ACTIONS)) {
      if (Array.isArray(entry)) expect(entry.length).toBeGreaterThan(0)
    }
  })

  it("keeps its words through every action that comes from the server", () => {
    expect(failures(reduce)).toEqual([])
  })

  it("is caught when a refusal puts back the saved page over it", () => {
    expect(failures(restoringReducer)).toContain("settled: b")
  })

  it("loses its words only through Use the saved page and Restore this line", () => {
    const before = {
      ...unsavedState(),
      moved: { basis: moved, head: elsewhere.blocks },
    }
    expect(
      overwrittenLines(before, reduce(before, { type: "useSaved" }))
    ).toEqual(["b"])
    expect(
      overwrittenLines(before, reduce(before, { type: "restoreLine", id: "b" }))
    ).toEqual(["b"])
  })

  it("keeps the saved lines equal to the page it is based on after every outcome", () => {
    for (const known of [true, false]) {
      for (const action of OUTCOMES.map(settle)) {
        const after = reduce(unsavedState(known), action)
        if (after.basis && after.saved)
          expect(pageWords(after.saved.blocks)).toBe(after.basis.words)
      }
    }
  })

  it("never puts text over a newer page: a moved outcome changes no line on screen", () => {
    const after = reduce(
      unsavedState(),
      settle({
        conflict: true,
        moved: { basis: moved, head: elsewhere.blocks },
      })
    )
    expect(after.present.blocks.map((block) => block.text)).toEqual([
      "Linh Nguyen",
      MINE,
    ])
    expect(after.basis).toEqual(basis)
    expect(after.moved?.basis).toEqual(moved)
  })
})
