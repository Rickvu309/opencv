import type { WritingDraft } from "./canvas-edit.ts"
import type { LookBook } from "./canvas-look.ts"

export const NUMBERED_LINE =
  "This paragraph is numbered. Paper can change its words but will not split, join or remove it."

export const KEPT_PART_LINE =
  "This paragraph has a link or a break. Paper can change the words around them but will not split, join or remove it."

function fixedNote(id: string, looks: LookBook): string | null {
  const form = looks.get(id)?.look.form
  if (form?.kind === "bullet" || form?.kind === "number") return NUMBERED_LINE
  if (id.includes("#")) return KEPT_PART_LINE
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
