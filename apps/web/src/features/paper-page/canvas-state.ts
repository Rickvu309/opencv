import { WORD_LIMITS } from "@workspace/domain"

import {
  adoptIds,
  blankDraft,
  commitComposition,
  deleteBackward,
  deleteForward,
  insertText,
  keptOnThisComputer,
  loadDraft,
  loadDraftBasis,
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
import { keepMine } from "./canvas-merge.ts"
import { pageWords } from "./canvas-save.ts"
import type { LineRefusal } from "./canvas-save-lines.ts"

const HISTORY_DEPTH = 50

export const CHANGED_IN_BOTH =
  "This line was also changed somewhere else. Your version is shown here and is not saved. Edit the line to save your version, or restore the saved one."

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
  | { type: "adopt"; blocks: WritingBlock[] }
  | { type: "basis"; basis: DraftBasis; typed: boolean }
  | { type: "replace"; draft: WritingDraft; basis: DraftBasis }
  | {
      type: "unsaved"
      lines?: LineRefusal[]
      page?: string | null
      words: string
    }
  | { type: "keepMine"; theirs: WritingDraft; basis: DraftBasis }
  | { type: "useSaved"; theirs: WritingDraft; basis: DraftBasis }
  | { type: "restoreLine"; id: string; text: string | null }
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
  if (action.type === "note") {
    return state.note === action.note ? state : { ...state, note: action.note }
  }
  if (action.type === "notice") return withNotice(state, action.notice)
  if (action.type === "basis") {
    const saved =
      !action.typed && action.basis.words === pageWords(state.present.blocks)
        ? state.present
        : state.saved
    if (sameBasis(state.basis, action.basis) && state.typed === action.typed) {
      return saved === state.saved ? state : { ...state, saved }
    }
    return { ...state, basis: action.basis, typed: action.typed, saved }
  }
  if (action.type === "redraw") return redrawn(state, state.present.caret)
  if (action.type === "unsaved") {
    if (pageWords(state.present.blocks) !== action.words) return state
    const unsaved = action.lines ?? state.unsaved
    const pageRefusal =
      action.page === undefined ? state.pageRefusal : action.page
    if (
      JSON.stringify(unsaved) === JSON.stringify(state.unsaved) &&
      pageRefusal === state.pageRefusal
    )
      return state
    return { ...state, unsaved, pageRefusal }
  }
  if (action.type === "keepMine") return keptMine(state, action)
  if (action.type === "useSaved") return usedSaved(state, action)
  if (action.type === "restoreLine") return restoredLine(state, action)
  if (action.type === "replace") {
    if (hasUnsavedWords(state)) return state
    const draft = plainDraft(action.draft)
    const looks = collectLooks(state.looks, action.draft.blocks)
    const same =
      JSON.stringify(state.present) === JSON.stringify(draft) &&
      sameBasis(state.basis, action.basis) &&
      !state.typed
    if (same) return looks === state.looks ? state : { ...state, looks }
    return {
      ...state,
      past: [],
      present: draft,
      future: [],
      looks,
      basis: action.basis,
      typed: false,
      saved: draft,
    }
  }
  if (action.type === "adopt") {
    const present = adoptIds(state.present, withoutLooks(action.blocks))
    const looks = collectLooks(state.looks, action.blocks)
    if (present === state.present && looks === state.looks) return state
    const saved = state.saved === state.present ? present : state.saved
    return { ...state, present, looks, saved }
  }
  if (action.type === "undo") return travel(state, true)
  if (action.type === "redo") return travel(state, false)
  return edited(state, action)
}

export function hasUnsavedWords(state: CanvasState) {
  return state.basis
    ? pageWords(state.present.blocks) !== state.basis.words
    : state.typed
}

function freshFrom(
  state: CanvasState,
  action: { theirs: WritingDraft; basis: DraftBasis },
  present: WritingDraft,
  unsaved: LineRefusal[]
): CanvasState {
  return {
    ...state,
    past: [],
    present,
    future: [],
    looks: collectLooks(state.looks, action.theirs.blocks),
    basis: action.basis,
    typed: pageWords(present.blocks) !== action.basis.words,
    saved: plainDraft(action.theirs),
    notice: "",
    unsaved,
    pageRefusal: null,
    redraw: state.redraw + 1,
  }
}

function keptMine(
  state: CanvasState,
  action: Extract<CanvasAction, { type: "keepMine" }>
): CanvasState {
  const merged = keepMine(state.saved, state.present, plainDraft(action.theirs))
  return freshFrom(
    state,
    action,
    merged.draft,
    merged.both.map((line) => ({ ...line, note: CHANGED_IN_BOTH }))
  )
}

function usedSaved(
  state: CanvasState,
  action: Extract<CanvasAction, { type: "useSaved" }>
): CanvasState {
  const present = plainDraft(action.theirs)
  return freshFrom(state, action, present, [])
}

function restoredLine(
  state: CanvasState,
  action: Extract<CanvasAction, { type: "restoreLine" }>
): CanvasState {
  const blocks =
    action.text === null
      ? state.present.blocks.filter((block) => block.id !== action.id)
      : state.present.blocks.map((block) =>
          block.id === action.id ? { ...block, text: action.text ?? "" } : block
        )
  if (blocks.length === 0) return state
  const caret = blocks.some((block) => block.id === state.present.caret.blockId)
    ? sensibleCaret({ ...state.present, blocks }, state.present.caret)
    : { blockId: blocks[0]?.id ?? "", offset: 0 }
  const present = { ...state.present, blocks, caret }
  return {
    ...state,
    past: state.past.concat(state.present).slice(-HISTORY_DEPTH),
    present,
    future: [],
    unsaved: state.unsaved.filter((line) => line.id !== action.id),
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
  const stored = loadDraft(docId, localStorage)
  const present = plainDraft(stored ?? seed ?? blankDraft())
  const basis =
    loadDraftBasis(docId, localStorage) ??
    (seedRevision
      ? { revision: seedRevision, words: pageWords(present.blocks) }
      : null)
  storeDraft(docId, present, localStorage, basis)
  const saved =
    basis && pageWords(present.blocks) === basis.words
      ? present
      : seed
        ? plainDraft(seed)
        : null
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
    unsaved: [],
    pageRefusal: null,
  }
}
