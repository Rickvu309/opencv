import type { WordHandle, WordLean, WordOp, WordPage } from "@workspace/domain"

import { pageBlocks, type TextPoint, type WritingBlock } from "./canvas-edit.ts"
import { typedReach } from "./canvas-look.ts"

export type PageDiff = { ops: WordOp[] } | { refused: string }

const KEPT_PART =
  "Part of this page is kept exactly as it is in Word. Put it back where it was to save your words. They stay on this computer."
const MOVED =
  "Lines were moved in a way Paper cannot save yet. Your words stay on this computer."

type Slot = { kind: "kept"; handle: WordHandle } | { kind: "new"; text: string }

function handleOf(id: string, handles: ReadonlySet<string>) {
  if (handles.has(id)) return id
  const mark = id.lastIndexOf("#")
  const base = mark > 0 ? id.slice(0, mark) : ""
  return handles.has(base) ? base : null
}

function keptPartsMatch(
  basis: readonly WritingBlock[],
  blocks: readonly WritingBlock[]
) {
  const before = basis.filter((block) => block.held)
  const after = blocks.filter((block) => block.held)
  return (
    before.length === after.length &&
    before.every(
      (block, index) =>
        after[index]?.id === block.id && after[index]?.text === block.text
    )
  )
}

function leanOf(
  basis: readonly WritingBlock[],
  block: WritingBlock,
  offset: number
): WordLean | null {
  const before = basis.find((item) => item.id === block.id)
  if (!before || before.held || before.text === block.text) return null
  return typedReach(before.text, block.text, offset).head === 0
    ? "after"
    : "before"
}

export function diffParagraphs(
  page: WordPage,
  blocks: readonly WritingBlock[],
  caret: TextPoint | null
): PageDiff {
  const basis = pageBlocks(page)
  if (!keptPartsMatch(basis, blocks)) return { refused: KEPT_PART }
  const handles = new Set(page.paragraphs.map((paragraph) => paragraph.handle))
  const written = new Map<WordHandle, string>()
  const carets = new Map<
    WordHandle,
    { at: number; lean: WordLean | null; keptBefore: number }
  >()
  const keptSoFar = new Map<WordHandle, number>()
  const slots: Slot[] = []
  let current: WordHandle | null = null
  for (const block of blocks) {
    const handle = handleOf(block.id, handles)
    if (handle === null) {
      slots.push({ kind: "new", text: block.text })
      current = null
      continue
    }
    if (handle !== current) {
      if (slots.some((slot) => slot.kind === "kept" && slot.handle === handle))
        return { refused: MOVED }
      slots.push({ kind: "kept", handle })
      current = handle
    }
    const keptBefore = keptSoFar.get(handle) ?? 0
    if (block.held) {
      keptSoFar.set(handle, keptBefore + 1)
      continue
    }
    const before = written.get(handle) ?? ""
    if (caret?.blockId === block.id)
      carets.set(handle, {
        at: before.length + caret.offset,
        lean: leanOf(basis, block, caret.offset),
        keptBefore,
      })
    written.set(handle, before + block.text)
  }
  const order = page.paragraphs.map((paragraph) => paragraph.handle)
  const kept = slots.flatMap((slot) =>
    slot.kind === "kept" ? [order.indexOf(slot.handle)] : []
  )
  if (kept.some((at, index) => index > 0 && at <= (kept[index - 1] ?? -1)))
    return { refused: MOVED }
  const surviving = new Set(
    slots.flatMap((slot) => (slot.kind === "kept" ? [slot.handle] : []))
  )
  const lines = page.paragraphs.filter((paragraph) => !paragraph.held)
  const gone = lines.filter((paragraph) => !surviving.has(paragraph.handle))
  const reused = gone[0]
  if (reused && lines.every((paragraph) => !surviving.has(paragraph.handle))) {
    const first = slots.findIndex((slot) => slot.kind === "new")
    const slot = slots[first]
    written.set(reused.handle, slot?.kind === "new" ? slot.text : "")
    const replacing: Slot = { kind: "kept", handle: reused.handle }
    if (first >= 0) slots.splice(first, 1, replacing)
    else slots.push(replacing)
    surviving.add(reused.handle)
  }
  const removedAfter = new Map<WordHandle | null, WordHandle[]>()
  let previous: WordHandle | null = null
  for (const paragraph of page.paragraphs) {
    if (surviving.has(paragraph.handle)) {
      previous = paragraph.handle
      continue
    }
    if (paragraph.held) continue
    removedAfter.set(previous, [
      ...(removedAfter.get(previous) ?? []),
      paragraph.handle,
    ])
  }
  const ops: WordOp[] = (removedAfter.get(null) ?? []).map((handle) => ({
    op: "delete",
    handle,
  }))
  let anchor: WordHandle | null = null
  for (const slot of slots) {
    if (slot.kind === "new") {
      ops.push({ op: "insert", after: anchor, text: slot.text })
      continue
    }
    anchor = slot.handle
    const paragraph = page.paragraphs.find(
      (item) => item.handle === slot.handle
    )
    const text = written.get(slot.handle) ?? ""
    if (paragraph && !paragraph.held && text !== paragraph.text) {
      const point = carets.get(slot.handle)
      ops.push({
        op: "setText",
        handle: slot.handle,
        text,
        ...(point === undefined ? {} : { caret: point.at }),
        ...(point?.lean
          ? { lean: point.lean, keptBefore: point.keptBefore }
          : {}),
      })
    }
    for (const handle of removedAfter.get(slot.handle) ?? [])
      ops.push({ op: "delete", handle })
  }
  return { ops }
}
