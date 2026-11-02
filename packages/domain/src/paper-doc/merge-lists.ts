import type { LetterPaper } from "./document.js"
import { flatItems } from "./merge-items.js"
import { rebaseRuns } from "./merge-text.js"
import type { Bullet, CvPaperBlock, ListItem, Numbered } from "./nodes.js"
import { plainTextOfRuns } from "./rich-text.js"

export type ListBlock = Bullet | Numbered

export function isListBlock(block: { type: string }): block is ListBlock {
  return block.type === "bullet" || block.type === "numbered"
}

type ListGroup = { readonly start: number; readonly end: number }

export function listGroups(blocks: readonly { type: string }[]): ListGroup[] {
  const groups: ListGroup[] = []
  let start = -1
  blocks.forEach((block, index) => {
    if (isListBlock(block)) {
      if (start < 0) start = index
    } else if (start >= 0) {
      groups.push({ start, end: index })
      start = -1
    }
  })
  if (start >= 0) groups.push({ start, end: blocks.length })
  return groups
}

export function groupIndexById(
  blocks: readonly CvPaperBlock[] | readonly LetterPaper["blocks"][number][],
  groups: readonly ListGroup[]
): Map<string, number> {
  const owner = new Map<string, number>()
  groups.forEach((group, index) => {
    for (const entry of flatItems(
      blocks.slice(group.start, group.end).filter(isListBlock)
    )) {
      owner.set(entry.item.id, index)
    }
  })
  return owner
}

export function itemsOfGroup(
  blocks: readonly { type: string }[],
  group: ListGroup
): ListItem[] {
  return blocks.slice(group.start, group.end).filter(isListBlock)
}

export function flatRun(
  run: readonly ListItem[],
  known: ReadonlyMap<string, ListItem>
): ListItem[] {
  return run.map((entry) => {
    const old = known.get(entry.id)
    return {
      id: entry.id,
      type: entry.type,
      content: old
        ? rebaseRuns(old.content, plainTextOfRuns(entry.content))
        : entry.content,
      children: [],
    }
  })
}
