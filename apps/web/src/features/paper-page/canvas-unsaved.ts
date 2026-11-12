import type { DraftBasis, WritingBlock, WritingDraft } from "./canvas-edit.ts"
import { SIGNED_OUT } from "./canvas-save.ts"
import { stillRefused, type LineRefusal } from "./canvas-save-lines.ts"
import type { CanvasState } from "./canvas-state.ts"

export type UnsavedCause = "moved" | "page" | "lines"

export type UnsavedBarModel = {
  cause: UnsavedCause | null
  causes: number
  discards: number
  unsavedText: string
  reason: string | null
  signIn: boolean
  lines: LineRefusal[]
}

export function changedLines(
  saved: WritingDraft | null,
  present: WritingDraft
): WritingBlock[] {
  if (!saved) return present.blocks.filter((block) => block.text !== "")
  const before = new Map(saved.blocks.map((block) => [block.id, block.text]))
  return present.blocks.filter((block) => before.get(block.id) !== block.text)
}

export type SavedPageSwap = {
  lines: WritingBlock[]
  removed: WritingBlock[]
  page: WritingBlock[]
  basis: DraftBasis
}

const TEMPORARY_LINE = /^p\d+$/

function serverTwin(
  saved: readonly WritingBlock[],
  theirs: readonly WritingBlock[]
) {
  const onServer = new Map(theirs.map((block, index) => [block.id, index]))
  const savedIds = new Set(saved.map((block) => block.id))
  const twins = new Map<string, string>()
  let from = 0
  let waiting: WritingBlock[] = []
  const pair = (to: number) => {
    const free = theirs
      .slice(from, to)
      .filter((block) => !savedIds.has(block.id))
    const unmatched = waiting.filter((line) => {
      const twin = free.findIndex((block) => block.text === line.text)
      const block = free[twin]
      if (!block) return true
      twins.set(line.id, block.id)
      free.splice(twin, 1)
      return false
    })
    unmatched.forEach((line, index) => {
      const block = free[index]
      if (block) twins.set(line.id, block.id)
    })
    waiting = []
  }
  for (const line of saved) {
    const at = onServer.get(line.id)
    if (at === undefined) {
      if (TEMPORARY_LINE.test(line.id)) waiting.push(line)
      continue
    }
    if (at >= from) {
      pair(at)
      from = at + 1
    }
  }
  pair(theirs.length)
  return (id: string) => twins.get(id) ?? id
}

export function savedPageSwap(state: CanvasState): SavedPageSwap | null {
  const moved = state.moved
  if (!moved) return null
  const saved = state.saved?.blocks ?? []
  const twin = serverTwin(saved, moved.head)
  const theirs = new Map(moved.head.map((block) => [block.id, block.text]))
  const kept = new Set(state.present.blocks.map((block) => block.id))
  return {
    lines: changedLines(state.saved, state.present).filter(
      (block) => !block.held && theirs.get(twin(block.id)) !== block.text
    ),
    removed: saved.filter(
      (block) =>
        !block.held && !kept.has(block.id) && theirs.has(twin(block.id))
    ),
    page: moved.head,
    basis: moved.basis,
  }
}

export function unsavedBar(state: CanvasState): UnsavedBarModel {
  const lines = stillRefused(state.unsaved, state.present.blocks)
  const causes = [
    state.moved ? "moved" : null,
    state.pageRefusal !== null ? "page" : null,
    lines.length > 0 ? "lines" : null,
  ].filter((cause): cause is UnsavedCause => cause !== null)
  const swap = savedPageSwap(state)
  const unsaved = swap ? swap.lines : changedLines(state.saved, state.present)
  return {
    cause: causes[0] ?? null,
    causes: causes.length,
    discards: swap ? swap.lines.length + swap.removed.length : 0,
    unsavedText: unsaved.map((block) => block.text).join("\n"),
    reason: state.pageRefusal,
    signIn: state.pageRefusal === SIGNED_OUT,
    lines,
  }
}

export function markedLines(state: CanvasState): string[] {
  const refused = stillRefused(state.unsaved, state.present.blocks)
    .filter((line) => !line.removed)
    .map((line) => line.id)
  const swap = savedPageSwap(state)
  const whole = swap
    ? swap.lines
    : state.pageRefusal !== null
      ? changedLines(state.saved, state.present)
      : []
  return [...new Set([...refused, ...whole.map((block) => block.id)])]
}
