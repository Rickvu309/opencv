import type { WritingBlock, WritingDraft } from "./canvas-edit.ts"

export type Merged = {
  draft: WritingDraft
  both: { id: string; text: string }[]
}

export function changedLines(
  saved: WritingDraft | null,
  present: WritingDraft
): WritingBlock[] {
  if (!saved) return present.blocks.filter((block) => block.text !== "")
  const before = new Map(saved.blocks.map((block) => [block.id, block.text]))
  return present.blocks.filter((block) => before.get(block.id) !== block.text)
}

export function droppedCount(
  saved: WritingDraft | null,
  present: WritingDraft
): number {
  const kept = new Set(present.blocks.map((block) => block.id))
  const removed = saved
    ? saved.blocks.filter((block) => !block.held && !kept.has(block.id)).length
    : 0
  return changedLines(saved, present).length + removed
}

export function keepMine(
  saved: WritingDraft | null,
  mine: WritingDraft,
  theirs: WritingDraft
): Merged {
  const base = new Map(
    (saved?.blocks ?? []).map((block) => [block.id, block.text])
  )
  const own = new Map(mine.blocks.map((block) => [block.id, block]))
  const onServer = new Set(theirs.blocks.map((block) => block.id))
  const edited = (block: WritingBlock) => base.get(block.id) !== block.text
  const both: { id: string; text: string }[] = []
  const following = new Map<string | null, WritingBlock[]>()
  let anchor: string | null = null
  for (const block of mine.blocks) {
    if (onServer.has(block.id)) {
      anchor = block.id
      continue
    }
    const removedElsewhere = base.has(block.id)
    if (removedElsewhere && !edited(block)) continue
    if (removedElsewhere) both.push({ id: block.id, text: block.text })
    following.set(anchor, [...(following.get(anchor) ?? []), block])
  }
  const blocks: WritingBlock[] = [...(following.get(null) ?? [])]
  for (const block of theirs.blocks) {
    const mineBlock = own.get(block.id)
    const after = following.get(block.id) ?? []
    if (block.held || !mineBlock) {
      const deletedHere =
        !block.held && base.has(block.id) && base.get(block.id) === block.text
      if (!deletedHere) blocks.push(block)
      blocks.push(...after)
      continue
    }
    if (!edited(mineBlock) || mineBlock.text === block.text) {
      blocks.push(block)
    } else {
      if (base.get(block.id) !== block.text)
        both.push({ id: block.id, text: mineBlock.text })
      blocks.push({ ...block, text: mineBlock.text })
    }
    blocks.push(...after)
  }
  const caretBlock = blocks.find((block) => block.id === mine.caret.blockId)
  const caret = caretBlock
    ? {
        blockId: caretBlock.id,
        offset: Math.min(mine.caret.offset, caretBlock.text.length),
      }
    : { blockId: blocks[0]?.id ?? theirs.caret.blockId, offset: 0 }
  return {
    draft: {
      blocks,
      caret,
      nextId: Math.max(mine.nextId, theirs.nextId),
    },
    both,
  }
}
