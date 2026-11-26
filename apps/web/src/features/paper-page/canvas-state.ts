import { writingStorage } from "./canvas-branch.ts"
import { WORD_LIMITS } from "@workspace/domain/paper-doc"

import {
  blankDraft,
  commitComposition,
  deleteBackward,
  deleteForward,
  insertText,
  keptOnThisComputer,
  loadDraft,
  loadDraftBasis,
  loadSavedDraft,
  loadUnsavedLines,
  replaceVisible,
  splitParagraph,
  storeDraft,
  type DraftBasis,
  type TextPoint,
  type TextSpan,
  type WritingBlock,
  type WritingDraft,
} from "./canvas-edit.ts"
import { fixedLineNote, heldLineNote } from "./canvas-fixed-lines.ts"
import {
  PASTE_LINE_LIMIT,
  PASTE_LINE_TOO_LONG,
  PASTE_TOO_MANY_LINES,
} from "./canvas-input.ts"
import { collectLooks, withoutLooks, type LookBook } from "./canvas-look.ts"
import { pastePlain, plainCharacters } from "./canvas-paste.ts"
import { reachSpan, type Reach } from "./canvas-reach.ts"
import { pageWords, savedNote } from "./canvas-save.ts"
import type { MovedPage, SaveOutcome } from "./canvas-save-outcome.ts"
import { savedPageSwap } from "./canvas-unsaved.ts"
import {
  sameRefusals,
  stillRefused,
  uniqueRefusals,
  type LineRefusal,
} from "./canvas-save-lines.ts"

const HISTORY_DEPTH = 50

export type CanvasState = {
  past: WritingDraft[]
  present: WritingDraft
  future: WritingDraft[]
  looks: LookBook
  note: string
  notice: string
  basis: DraftBasis | null
  typed: boolean
  saved: WritingDraft | null
  redraw: number
  unsaved: LineRefusal[]
  pageRefusal: string | null
  moved: MovedPage | null
  recovering?: boolean
}

export type CanvasAction =
  | {
      type: "insert"
      span: TextSpan
      text: string
      live?: { id: string; text: string }[]
      nextId?: number
    }
  | { type: "split"; span: TextSpan }
  | {
      type: "delete"
      span: TextSpan
      direction: "backward" | "forward"
      reach: Reach
    }
  | { type: "paste"; span: TextSpan; text: string }
  | {
      type: "composed"
      texts: { id: string; text: string }[]
      caret: TextPoint
      from: TextSpan | null
      split: boolean
      nextId: number
    }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "note"; note: string }
  | { type: "notice"; notice: string }
  | { type: "settled"; outcome: SaveOutcome; words: string; typed: boolean }
  | { type: "useSaved" }
  | { type: "recovered"; state: CanvasState }
  | { type: "recovering"; active: boolean }
  | { type: "restoreLine"; id: string }
  | { type: "redraw" }

function sameBasis(left: DraftBasis | null, right: DraftBasis | null) {
  if (left === right) return true
  if (!left || !right) return false
  return left.revision === right.revision && left.words === right.words
}

export function plainDraft(draft: WritingDraft): WritingDraft {
  return draft.blocks.some((block) => block.look)
    ? { ...draft, blocks: withoutLooks(draft.blocks) }
    : draft
}

function remember(state: CanvasState, present: WritingDraft): CanvasState {
  if (JSON.stringify(state.present) === JSON.stringify(present)) return state
  const fixed = fixedLineNote(state.present, present, state.looks)
  if (fixed) return withNotice(state, fixed)
  return {
    ...state,
    past: state.past.concat(state.present).slice(-HISTORY_DEPTH),
    present,
    future: [],
    note: state.note === "Saved" ? keptOnThisComputer() : state.note,
    notice: "",
    typed: true,
  }
}

function withNotice(state: CanvasState, notice: string): CanvasState {
  return state.notice === notice ? state : { ...state, notice }
}

function startOf(draft: WritingDraft, span: TextSpan): TextPoint {
  const anchor = draft.blocks.findIndex(
    (block) => block.id === span.anchor.blockId
  )
  const focus = draft.blocks.findIndex(
    (block) => block.id === span.focus.blockId
  )
  if (anchor < 0) return span.focus
  if (focus < 0) return span.anchor
  if (anchor !== focus) return anchor < focus ? span.anchor : span.focus
  return span.anchor.offset <= span.focus.offset ? span.anchor : span.focus
}

function sensibleCaret(draft: WritingDraft, point: TextPoint): TextPoint {
  const block = draft.blocks.find((item) => item.id === point.blockId)
  if (!block || block.held) return draft.caret
  return {
    blockId: block.id,
    offset: Math.max(0, Math.min(point.offset, block.text.length)),
  }
}

function redrawn(state: CanvasState, caret: TextPoint): CanvasState {
  return {
    ...state,
    present: {
      ...state.present,
      caret: sensibleCaret(state.present, caret),
    },
    redraw: state.redraw + 1,
  }
}

function showsPresent(
  present: WritingDraft,
  texts: { id: string; text: string }[]
) {
  return (
    texts.length === present.blocks.length &&
    texts.every(
      (item, index) =>
        item.id === present.blocks[index]?.id &&
        item.text === present.blocks[index]?.text
    )
  )
}

function typedAgainst(state: CanvasState, present: WritingDraft) {
  return state.basis
    ? pageWords(present.blocks) !== state.basis.words
    : state.typed
}

function travel(state: CanvasState, back: boolean): CanvasState {
  const from = back ? state.past : state.future
  const present = from[from.length - 1]
  if (!present) return state
  const rest = from.slice(0, -1)
  const typed = typedAgainst(state, present)
  return back
    ? {
        ...state,
        past: rest,
        present,
        future: state.future.concat(state.present),
        notice: "",
        typed,
      }
    : {
        ...state,
        past: state.past.concat(state.present).slice(-HISTORY_DEPTH),
        present,
        future: rest,
        notice: "",
        typed,
      }
}

function pasteRefusal(text: string): string | null {
  const lines = plainCharacters(text).split("\n")
  if (lines.length > PASTE_LINE_LIMIT) return PASTE_TOO_MANY_LINES
  const encoder = new TextEncoder()
  const long = lines.some(
    (line) => encoder.encode(line).byteLength > WORD_LIMITS.maxTextBytes
  )
  return long ? PASTE_LINE_TOO_LONG : null
}

function composed(
  state: CanvasState,
  action: Extract<CanvasAction, { type: "composed" }>
): CanvasState {
  const from = action.from
  const held = from ? heldLineNote(state.present, from, state.looks) : null
  if (from && held) {
    return withNotice(redrawn(state, startOf(state.present, from)), held)
  }
  const visible = replaceVisible(
    { ...state.present, nextId: action.nextId },
    action.texts,
    action.caret
  )
  if (!action.split) return remember(state, visible)
  const split = commitComposition({ ...visible, caret: action.caret }, "", true)
  const fixed = fixedLineNote(state.present, split, state.looks)
  return fixed
    ? withNotice(remember(state, visible), fixed)
    : remember(state, split)
}

function edited(state: CanvasState, action: CanvasAction): CanvasState {
  if (action.type === "composed") {
    const next = composed(state, action)
    if (next.present !== state.present || next.redraw !== state.redraw)
      return next
    if (showsPresent(state.present, action.texts)) return next
    const caret = action.from
      ? startOf(state.present, action.from)
      : action.caret
    return redrawn(next, caret)
  }
  if (
    action.type === "insert" ||
    action.type === "split" ||
    action.type === "paste" ||
    action.type === "delete"
  ) {
    const held = heldLineNote(state.present, action.span, state.looks)
    if (held) return withNotice(state, held)
  }
  if (action.type === "insert") {
    const base = action.live
      ? replaceVisible(
          { ...state.present, nextId: action.nextId ?? state.present.nextId },
          action.live,
          action.span.anchor
        )
      : state.present
    return remember(state, insertText(base, action.span, action.text))
  }
  if (action.type === "split")
    return remember(state, splitParagraph(state.present, action.span))
  if (action.type === "paste") {
    const refusal = pasteRefusal(action.text)
    if (refusal) return withNotice(state, refusal)
    return remember(state, pastePlain(state.present, action.span, action.text))
  }
  if (action.type === "delete") {
    const span = reachSpan(
      state.present,
      action.span,
      action.direction,
      action.reach
    )
    const empty =
      span.anchor.blockId === span.focus.blockId &&
      span.anchor.offset === span.focus.offset
    if (action.reach === "selection" && empty) return state
    return remember(
      state,
      action.direction === "backward"
        ? deleteBackward(state.present, span)
        : deleteForward(state.present, span)
    )
  }
  return state
}

export function reduce(state: CanvasState, action: CanvasAction): CanvasState {
  if (action.type === "recovering")
    return { ...state, recovering: action.active }
  if (action.type === "recovered")
    return { ...action.state, redraw: state.redraw + 1 }
  if (action.type === "note") {
    return state.note === action.note ? state : { ...state, note: action.note }
  }
  if (action.type === "notice") return withNotice(state, action.notice)
  if (action.type === "redraw") return redrawn(state, state.present.caret)
  if (action.type === "settled") return settled(state, action)
  if (action.type === "useSaved") return usedSaved(state)
  if (action.type === "restoreLine") return restoredLine(state, action.id)
  if (action.type === "undo") return travel(state, true)
  if (action.type === "redo") return travel(state, false)
  return edited(state, action)
}

export function hasUnsavedWords(state: CanvasState) {
  return state.basis
    ? pageWords(state.present.blocks) !== state.basis.words
    : state.typed
}

function draftOf(blocks: readonly WritingBlock[], caret: TextPoint) {
  const plain = withoutLooks(blocks)
  const kept = plain.find((block) => block.id === caret.blockId && !block.held)
  const first = plain.find((block) => !block.held) ?? plain[0]
  return {
    blocks: plain,
    caret: kept
      ? { blockId: kept.id, offset: Math.min(caret.offset, kept.text.length) }
      : { blockId: first?.id ?? caret.blockId, offset: 0 },
    nextId: Math.max(blocks.length + 1, 1),
  }
}

function sameBlocks(
  left: readonly WritingBlock[] | undefined,
  right: readonly WritingBlock[]
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function renamedDraft(
  draft: WritingDraft,
  renames: Record<string, string>
): WritingDraft {
  if (!draft.blocks.some((block) => renames[block.id])) return draft
  return {
    ...draft,
    blocks: draft.blocks.map((block) => {
      const id = renames[block.id]
      return id ? { ...block, id } : block
    }),
    caret: {
      ...draft.caret,
      blockId: renames[draft.caret.blockId] ?? draft.caret.blockId,
    },
  }
}

function renamedState(
  state: CanvasState,
  renames: Record<string, string>
): CanvasState {
  const taken = new Set(state.present.blocks.map((block) => block.id))
  const usable = Object.fromEntries(
    Object.entries(renames).filter(
      ([from, to]) => taken.has(from) && !taken.has(to)
    )
  )
  if (Object.keys(usable).length === 0) return state
  return {
    ...state,
    past: state.past.map((draft) => renamedDraft(draft, usable)),
    present: renamedDraft(state.present, usable),
    future: state.future.map((draft) => renamedDraft(draft, usable)),
    unsaved: state.unsaved.map((line) =>
      usable[line.id] ? { ...line, id: usable[line.id] ?? line.id } : line
    ),
  }
}

function basedOn(
  state: CanvasState,
  basis: DraftBasis,
  head: readonly WritingBlock[] | undefined,
  words: string
): CanvasState {
  const typed = basis.words !== words
  const saved = head
    ? sameBlocks(state.saved?.blocks, withoutLooks(head))
      ? state.saved
      : draftOf(head, state.present.caret)
    : basis.words === pageWords(state.present.blocks)
      ? state.present
      : state.saved
  const looks = head ? collectLooks(state.looks, head) : state.looks
  if (
    sameBasis(state.basis, basis) &&
    state.typed === typed &&
    saved === state.saved &&
    looks === state.looks
  )
    return state
  return {
    ...state,
    basis: sameBasis(state.basis, basis) ? state.basis : basis,
    typed,
    saved,
    looks,
  }
}

function withRefusals(
  state: CanvasState,
  lines: readonly LineRefusal[] | undefined,
  page: string | null | undefined
): CanvasState {
  const unsaved = lines
    ? stillRefused(uniqueRefusals(lines), state.present.blocks)
    : state.unsaved
  const pageRefusal = page === undefined ? state.pageRefusal : page
  const same = sameRefusals(unsaved, state.unsaved)
  if (same && pageRefusal === state.pageRefusal) return state
  return {
    ...state,
    unsaved: same ? state.unsaved : unsaved,
    pageRefusal,
  }
}

function replaced(
  state: CanvasState,
  replacement: WritingDraft,
  basis: DraftBasis
): CanvasState {
  if (hasUnsavedWords(state)) return state
  const draft = plainDraft(replacement)
  const looks = collectLooks(state.looks, replacement.blocks)
  const same =
    JSON.stringify(state.present) === JSON.stringify(draft) &&
    sameBasis(state.basis, basis) &&
    !state.typed &&
    state.moved === null
  if (same) return looks === state.looks ? state : { ...state, looks }
  return {
    ...state,
    past: [],
    present: draft,
    future: [],
    looks,
    basis,
    typed: false,
    saved: draft,
    unsaved: [],
    pageRefusal: null,
    moved: null,
  }
}

function settledNote(
  state: CanvasState,
  outcome: SaveOutcome,
  words: string,
  typed: boolean
): CanvasState {
  const note = savedNote(words, outcome)
  if (note) return reduce(state, { type: "note", note })
  if (!typed && words !== "")
    return reduce(state, { type: "note", note: keptOnThisComputer() })
  return state
}

function settled(
  state: CanvasState,
  action: Extract<CanvasAction, { type: "settled" }>
): CanvasState {
  const { outcome, words, typed } = action
  if (pageWords(state.present.blocks) !== words) return state
  if (outcome.moved) {
    const moved = outcome.moved
    const same =
      state.moved !== null &&
      sameBasis(state.moved.basis, moved.basis) &&
      sameBlocks(state.moved.head, moved.head)
    return same ? state : { ...state, moved }
  }
  if (outcome.replace && outcome.basis)
    return replaced(state, outcome.replace, outcome.basis)
  let next = outcome.renamed ? renamedState(state, outcome.renamed) : state
  if (outcome.basis) next = basedOn(next, outcome.basis, outcome.head, words)
  if (outcome.saved) {
    next =
      next.unsaved.length === 0 &&
      next.pageRefusal === null &&
      next.moved === null
        ? next
        : { ...next, unsaved: [], pageRefusal: null, moved: null }
  } else if (
    outcome.refusedLines !== undefined ||
    outcome.pageRefusal !== undefined
  ) {
    next = withRefusals(next, outcome.refusedLines, outcome.pageRefusal)
  }
  return settledNote(next, outcome, words, typed)
}

function usedSaved(state: CanvasState): CanvasState {
  const swap = savedPageSwap(state)
  if (!swap) return state
  const present = draftOf(swap.page, state.present.caret)
  return {
    ...state,
    past: [],
    present,
    future: [],
    looks: collectLooks(state.looks, swap.page),
    basis: swap.basis,
    typed: false,
    saved: present,
    notice: "",
    unsaved: [],
    pageRefusal: null,
    moved: null,
    redraw: state.redraw + 1,
  }
}

function restoredBlocks(
  state: CanvasState,
  line: LineRefusal
): WritingBlock[] | null {
  const blocks = state.present.blocks
  const saved = state.saved?.blocks ?? []
  const prior = saved.find((block) => block.id === line.id)
  if (line.removed) {
    if (!prior || blocks.some((block) => block.id === line.id)) return null
    const index = saved.indexOf(prior)
    const before = saved
      .slice(0, index)
      .reverse()
      .find((block) => blocks.some((item) => item.id === block.id))
    const at = before
      ? blocks.findIndex((block) => block.id === before.id) + 1
      : 0
    const next = blocks.slice()
    next.splice(at, 0, { id: prior.id, text: prior.text })
    return next
  }
  if (prior)
    return blocks.map((block) =>
      block.id === line.id ? { ...block, text: prior.text } : block
    )
  const without = blocks.filter((block) => block.id !== line.id)
  return without.length > 0 ? without : null
}

function restoredLine(state: CanvasState, id: string): CanvasState {
  const line = stillRefused(state.unsaved, state.present.blocks).find(
    (item) => item.id === id
  )
  if (!line) return state
  const blocks = restoredBlocks(state, line)
  if (!blocks) return state
  const caret = blocks.some((block) => block.id === state.present.caret.blockId)
    ? sensibleCaret({ ...state.present, blocks }, state.present.caret)
    : { blockId: blocks[0]?.id ?? "", offset: 0 }
  const present = { ...state.present, blocks, caret }
  return {
    ...state,
    past: state.past.concat(state.present).slice(-HISTORY_DEPTH),
    present,
    future: [],
    unsaved: state.unsaved.filter((item) => item.id !== id),
    typed: typedAgainst(state, present),
    notice: "",
    redraw: state.redraw + 1,
  }
}

export function openSheet(
  docId: string,
  seed: WritingDraft | null,
  seedRevision: string | null
): CanvasState {
  const stored = loadDraft(docId, writingStorage)
  const present = plainDraft(stored ?? seed ?? blankDraft())
  const basis =
    loadDraftBasis(docId, writingStorage) ??
    (seedRevision
      ? { revision: seedRevision, words: pageWords(present.blocks) }
      : null)
  const savedAtBasis = (draft: WritingDraft | null) =>
    draft && basis && pageWords(draft.blocks) === basis.words
      ? plainDraft(draft)
      : null
  const saved = !basis
    ? null
    : pageWords(present.blocks) === basis.words
      ? present
      : (savedAtBasis(loadSavedDraft(docId, writingStorage)) ??
        savedAtBasis(seed))
  const unsaved = stillRefused(
    loadUnsavedLines(docId, writingStorage),
    present.blocks
  )
  storeDraft(docId, present, writingStorage, basis, { saved, unsaved })
  return {
    past: [],
    present,
    future: [],
    looks: collectLooks(new Map(), seed?.blocks ?? []),
    note: pageWords(present.blocks) === "" ? keptOnThisComputer() : "",
    notice: "",
    basis,
    typed: false,
    saved,
    redraw: 0,
    unsaved,
    pageRefusal: null,
    moved: null,
  }
}
