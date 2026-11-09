import type { PaperView } from "@workspace/domain"

export type WritingBlock = {
  id: string
  text: string
}

export type TextPoint = {
  blockId: string
  offset: number
}

export type TextSpan = {
  anchor: TextPoint
  focus: TextPoint
}

export type WritingDraft = {
  blocks: WritingBlock[]
  caret: TextPoint
  nextId: number
}

const STARTER_NOTE = "Writing is not saved yet."

export function keptOnThisComputer(): string {
  return `${STARTER_NOTE} A copy stays on this computer.`
}

export function clearedOnReload(): string {
  return `${STARTER_NOTE} A reload clears these words.`
}

export function blankDraft(): WritingDraft {
  return {
    blocks: [{ id: "p1", text: "" }],
    caret: { blockId: "p1", offset: 0 },
    nextId: 2,
  }
}

export function pointSpan(point: TextPoint): TextSpan {
  return { anchor: point, focus: point }
}

export function opensWritingCanvas(doc: PaperView): boolean {
  if (doc.kind !== "cv" || doc.sourceFileId !== null) return false
  const paper = doc.paper
  if (paper?.kind !== "cv") return false
  const header = paper.header
  if (
    header.name ||
    header.email ||
    header.phone ||
    header.city ||
    header.linkedin ||
    header.photo
  ) {
    return false
  }
  return paper.blocks.every((block) => block.type === "section")
}

export function insertText(
  draft: WritingDraft,
  span: TextSpan,
  text: string
): WritingDraft {
  if (text.includes("\n") || text.includes("\r")) return draft
  const cleared = deleteSpan(draft, span)
  return writeAtCaret(cleared, text)
}

export function splitParagraph(
  draft: WritingDraft,
  span: TextSpan
): WritingDraft {
  return breakAtCaret(deleteSpan(draft, span))
}

export function deleteBackward(
  draft: WritingDraft,
  span: TextSpan
): WritingDraft {
  if (!isCollapsed(span)) return deleteSpan(draft, span)
  const placed = place(draft, span.anchor)
  const block = placed.blocks.find((item) => item.id === placed.caret.blockId)
  if (!block) return placed
  if (placed.caret.offset > 0) {
    return writeAtCaret(placed, "", 1)
  }
  if (block.text.length === 0) return removeEmpty(placed)
  return joinPrevious(placed)
}

export function deleteForward(
  draft: WritingDraft,
  span: TextSpan
): WritingDraft {
  if (!isCollapsed(span)) return deleteSpan(draft, span)
  const placed = place(draft, span.anchor)
  const index = placed.blocks.findIndex(
    (item) => item.id === placed.caret.blockId
  )
  const block = placed.blocks[index]
  if (!block) return placed
  if (block.text.length === 0) return removeEmpty(placed)
  if (placed.caret.offset < block.text.length) {
    const text =
      block.text.slice(0, placed.caret.offset) +
      block.text.slice(placed.caret.offset + 1)
    return replaceBlock(placed, index, { ...block, text }, placed.caret)
  }
  return placed
}

export function commitComposition(
  draft: WritingDraft,
  word: string,
  split: boolean
): WritingDraft {
  const inserted = insertText(draft, pointSpan(draft.caret), word)
  return split ? splitParagraph(inserted, pointSpan(inserted.caret)) : inserted
}

export function replaceVisible(
  draft: WritingDraft,
  texts: readonly { id: string; text: string }[],
  caret: TextPoint
): WritingDraft {
  const blocks = texts.map((item) => ({
    id: item.id,
    text: item.text.replaceAll("\u200b", ""),
  }))
  if (blocks.length === 0) return blankDraft()
  const known = blocks.some((item) => item.id === caret.blockId)
    ? caret
    : { blockId: blocks[0]?.id ?? "p1", offset: 0 }
  return place({ blocks, caret: known, nextId: draft.nextId }, known)
}

export function loadDraft(
  docId: string,
  storage: Pick<Storage, "getItem">
): WritingDraft | null {
  try {
    const raw = storage.getItem(storageKey(docId))
    if (!raw) return null
    const value = JSON.parse(raw) as WritingDraft
    if (!value || !Array.isArray(value.blocks) || value.blocks.length === 0) {
      return null
    }
    const blocksOk = value.blocks.every(
      (block) =>
        !!block &&
        typeof block.id === "string" &&
        typeof block.text === "string"
    )
    if (!blocksOk || typeof value.nextId !== "number" || !value.caret) {
      return null
    }
    return place(value, value.caret)
  } catch {
    return null
  }
}

export function storeDraft(
  docId: string,
  draft: WritingDraft,
  storage: Pick<Storage, "setItem">
): boolean {
  try {
    storage.setItem(storageKey(docId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

function storageKey(docId: string) {
  return `opencv-writing:${docId}`
}

function isCollapsed(span: TextSpan) {
  return (
    span.anchor.blockId === span.focus.blockId &&
    span.anchor.offset === span.focus.offset
  )
}

function place(draft: WritingDraft, point: TextPoint): WritingDraft {
  const block =
    draft.blocks.find((item) => item.id === point.blockId) ?? draft.blocks[0]
  if (!block) return blankDraft()
  const offset = Math.max(0, Math.min(point.offset, block.text.length))
  return {
    blocks: draft.blocks,
    caret: { blockId: block.id, offset },
    nextId: draft.nextId,
  }
}

function writeAtCaret(
  draft: WritingDraft,
  text: string,
  remove = 0
): WritingDraft {
  const index = draft.blocks.findIndex(
    (item) => item.id === draft.caret.blockId
  )
  const block = draft.blocks[index]
  if (!block) return draft
  const offset = draft.caret.offset
  const start = Math.max(0, offset - remove)
  const nextText = block.text.slice(0, start) + text + block.text.slice(offset)
  return replaceBlock(
    draft,
    index,
    { ...block, text: nextText },
    { blockId: block.id, offset: start + text.length }
  )
}

function breakAtCaret(draft: WritingDraft): WritingDraft {
  const index = draft.blocks.findIndex(
    (item) => item.id === draft.caret.blockId
  )
  const block = draft.blocks[index]
  if (!block) return draft
  const id = `p${draft.nextId}`
  const offset = draft.caret.offset
  const blocks = [
    ...draft.blocks.slice(0, index),
    { id: block.id, text: block.text.slice(0, offset) },
    { id, text: block.text.slice(offset) },
    ...draft.blocks.slice(index + 1),
  ]
  return {
    blocks,
    caret: { blockId: id, offset: 0 },
    nextId: draft.nextId + 1,
  }
}

function joinPrevious(draft: WritingDraft): WritingDraft {
  const index = draft.blocks.findIndex(
    (item) => item.id === draft.caret.blockId
  )
  if (index <= 0) return draft
  const previous = draft.blocks[index - 1]
  const block = draft.blocks[index]
  if (!previous || !block) return draft
  const merged = { id: previous.id, text: previous.text + block.text }
  return {
    blocks: [
      ...draft.blocks.slice(0, index - 1),
      merged,
      ...draft.blocks.slice(index + 1),
    ],
    caret: { blockId: previous.id, offset: previous.text.length },
    nextId: draft.nextId,
  }
}

function removeEmpty(draft: WritingDraft): WritingDraft {
  const index = draft.blocks.findIndex(
    (item) => item.id === draft.caret.blockId
  )
  const block = draft.blocks[index]
  if (!block || block.text.length > 0 || draft.blocks.length < 2) return draft
  const previous = draft.blocks[index - 1]
  const next = draft.blocks[index + 1]
  const blocks = [
    ...draft.blocks.slice(0, index),
    ...draft.blocks.slice(index + 1),
  ]
  if (previous) {
    return {
      blocks,
      caret: { blockId: previous.id, offset: previous.text.length },
      nextId: draft.nextId,
    }
  }
  if (!next) return draft
  return {
    blocks,
    caret: { blockId: next.id, offset: 0 },
    nextId: draft.nextId,
  }
}

function replaceBlock(
  draft: WritingDraft,
  index: number,
  block: WritingBlock,
  caret: TextPoint
): WritingDraft {
  const blocks = draft.blocks.slice()
  blocks[index] = block
  return { blocks, caret, nextId: draft.nextId }
}

function deleteSpan(draft: WritingDraft, span: TextSpan): WritingDraft {
  if (isCollapsed(span)) return place(draft, span.anchor)
  const ordered = order(draft, span)
  if (!ordered) return draft
  const { start, end, startIndex, endIndex } = ordered
  const startBlock = draft.blocks[startIndex]
  const endBlock = draft.blocks[endIndex]
  if (!startBlock || !endBlock) return draft
  const text =
    startBlock.text.slice(0, start.offset) + endBlock.text.slice(end.offset)
  const blocks = [
    ...draft.blocks.slice(0, startIndex),
    { id: startBlock.id, text },
    ...draft.blocks.slice(endIndex + 1),
  ]
  return {
    blocks: blocks.length === 0 ? [{ id: "p1", text: "" }] : blocks,
    caret: { blockId: startBlock.id, offset: start.offset },
    nextId: draft.nextId,
  }
}

function order(draft: WritingDraft, span: TextSpan) {
  const startIndex = draft.blocks.findIndex(
    (item) => item.id === span.anchor.blockId
  )
  const endIndex = draft.blocks.findIndex(
    (item) => item.id === span.focus.blockId
  )
  if (startIndex < 0 || endIndex < 0) return null
  const anchorFirst =
    startIndex < endIndex ||
    (startIndex === endIndex && span.anchor.offset <= span.focus.offset)
  const start = anchorFirst ? span.anchor : span.focus
  const end = anchorFirst ? span.focus : span.anchor
  const from = anchorFirst ? startIndex : endIndex
  const to = anchorFirst ? endIndex : startIndex
  const startBlock = draft.blocks[from]
  const endBlock = draft.blocks[to]
  if (!startBlock || !endBlock) return null
  return {
    start: {
      blockId: start.blockId,
      offset: Math.max(0, Math.min(start.offset, startBlock.text.length)),
    },
    end: {
      blockId: end.blockId,
      offset: Math.max(0, Math.min(end.offset, endBlock.text.length)),
    },
    startIndex: from,
    endIndex: to,
  }
}
