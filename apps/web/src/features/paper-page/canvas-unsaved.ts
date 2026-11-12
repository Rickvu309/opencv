import type { WritingBlock, WritingDraft } from "./canvas-edit.ts"
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

function removedLines(saved: WritingDraft | null, present: WritingDraft) {
  if (!saved) return []
  const kept = new Set(present.blocks.map((block) => block.id))
  return saved.blocks.filter((block) => !block.held && !kept.has(block.id))
}

export function discardedLines(state: CanvasState) {
  if (!state.moved) return { lines: [], removed: [] }
  const theirs = new Map(
    state.moved.head.map((block) => [block.id, block.text])
  )
  return {
    lines: changedLines(state.saved, state.present).filter(
      (block) => !block.held && theirs.get(block.id) !== block.text
    ),
    removed: removedLines(state.saved, state.present).filter((block) =>
      theirs.has(block.id)
    ),
  }
}

export function unsavedBar(state: CanvasState): UnsavedBarModel {
  const lines = stillRefused(state.unsaved, state.present.blocks)
  const causes = [
    state.moved ? "moved" : null,
    state.pageRefusal !== null ? "page" : null,
    lines.length > 0 ? "lines" : null,
  ].filter((cause): cause is UnsavedCause => cause !== null)
  const dropped = discardedLines(state)
  const unsaved = state.moved
    ? dropped.lines
    : changedLines(state.saved, state.present)
  return {
    cause: causes[0] ?? null,
    causes: causes.length,
    discards: dropped.lines.length + dropped.removed.length,
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
  const whole = state.moved
    ? discardedLines(state).lines
    : state.pageRefusal !== null
      ? changedLines(state.saved, state.present)
      : []
  return [...new Set([...refused, ...whole.map((block) => block.id)])]
}
