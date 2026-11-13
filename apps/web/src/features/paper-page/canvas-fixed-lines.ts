import type { TextSpan, WritingBlock, WritingDraft } from "./canvas-edit.ts"
import { CHANGE_NOT_SUPPORTED } from "./canvas-input.ts"
import type { LookBook } from "./canvas-look.ts"

export const NUMBERED_LINE =
  "This numbered or bulleted line can't be split, joined or removed here yet. Typing inside it works."

export const KEPT_PART_LINE =
  "This line has a link or a break, so it can't be split, joined or removed here yet. Typing inside it works."

function fixedNote(id: string, looks: LookBook): string | null {
  const form = looks.get(id)?.look.form
  if (form?.kind === "bullet" || form?.kind === "number") return NUMBERED_LINE
  if (id.includes("#")) return KEPT_PART_LINE
  return null
}

function keptLineNote(block: WritingBlock, looks: LookBook): string | null {
  const fixed = fixedNote(block.id, looks)
  if (fixed) return fixed
  return block.held ? block.reason || CHANGE_NOT_SUPPORTED : null
}

export function heldLineNote(
  draft: WritingDraft,
  span: TextSpan,
  looks: LookBook
): string | null {
  const ids = draft.blocks.map((block) => block.id)
  const anchor = ids.indexOf(span.anchor.blockId)
  const focus = ids.indexOf(span.focus.blockId)
  if (anchor < 0 || focus < 0 || anchor === focus) return null
  const reached = draft.blocks.slice(
    Math.min(anchor, focus),
    Math.max(anchor, focus) + 1
  )
  for (const block of reached) {
    const note = keptLineNote(block, looks)
    if (note) return note
  }
  return null
}

export function fixedLineNote(
  before: WritingDraft,
  after: WritingDraft,
  looks: LookBook
): string | null {
  const beforeIds = new Set(before.blocks.map((block) => block.id))
  const afterIds = new Set(after.blocks.map((block) => block.id))
  const removed = before.blocks.filter((block) => !afterIds.has(block.id))
  const added = after.blocks.some((block) => !beforeIds.has(block.id))
  if (removed.length === 0 && !added) return null
  for (const block of removed) {
    const note = fixedNote(block.id, looks)
    if (note) return note
  }
  let kept: string | null = null
  for (const block of after.blocks) {
    if (beforeIds.has(block.id)) {
      kept = block.id
      continue
    }
    const note = kept ? fixedNote(kept, looks) : null
    if (note) return note
  }
  if (removed.length === 0) return null
  for (const block of after.blocks) {
    const was = before.blocks.find((item) => item.id === block.id)
    if (!was || was.text === block.text) continue
    const note = fixedNote(block.id, looks)
    if (note) return note
  }
  return null
}
