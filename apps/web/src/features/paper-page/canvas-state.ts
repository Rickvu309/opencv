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
import { fixedLineNote } from "./canvas-fixed-lines.ts"
import { PASTE_TOO_LONG } from "./canvas-input.ts"
import { collectLooks, withoutLooks, type LookBook } from "./canvas-look.ts"
import { pastePlain, plainCharacters } from "./canvas-paste.ts"
import { reachSpan, type Reach } from "./canvas-reach.ts"
import { pageWords } from "./canvas-save.ts"

const HISTORY_DEPTH = 50

export const PASTE_LINE_LIMIT = Math.floor(WORD_LIMITS.maxOpsPerApply / 2)

export type CanvasState = {
  past: WritingDraft[]
  present: WritingDraft
  future: WritingDraft[]
  looks: LookBook
  note: string
  notice: string
  basis: DraftBasis | null
  typed: boolean
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

function tooLong(text: string) {
  const lines = plainCharacters(text).split("\n")
  const encoder = new TextEncoder()
  return (
    lines.length > PASTE_LINE_LIMIT ||
    lines.some(
      (line) => encoder.encode(line).byteLength > WORD_LIMITS.maxTextBytes
    )
  )
}

function edited(state: CanvasState, action: CanvasAction): CanvasState {
  if (action.type === "composed") {
    const visible = replaceVisible(
      { ...state.present, nextId: action.nextId },
      action.texts,
      action.caret
    )
    if (!action.split) return remember(state, visible)
    const split = commitComposition(
      { ...visible, caret: action.caret },
      "",
      true
    )
    const fixed = fixedLineNote(state.present, split, state.looks)
    return fixed
      ? withNotice(remember(state, visible), fixed)
      : remember(state, split)
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
    if (tooLong(action.text)) return withNotice(state, PASTE_TOO_LONG)
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
    if (sameBasis(state.basis, action.basis) && state.typed === action.typed) {
      return state
    }
    return { ...state, basis: action.basis, typed: action.typed }
  }
  if (action.type === "replace") {
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
    }
  }
  if (action.type === "adopt") {
    const present = adoptIds(state.present, withoutLooks(action.blocks))
    const looks = collectLooks(state.looks, action.blocks)
    return present === state.present && looks === state.looks
      ? state
      : { ...state, present, looks }
  }
  if (action.type === "undo") return travel(state, true)
  if (action.type === "redo") return travel(state, false)
  return edited(state, action)
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
  return {
    past: [],
    present,
    future: [],
    looks: collectLooks(new Map(), seed?.blocks ?? []),
    note: pageWords(present.blocks) === "" ? keptOnThisComputer() : "",
    notice: "",
    basis,
    typed: false,
  }
}
