import * as Y from "yjs"

import type { PaperPartialBlock } from "./schema.js"
import { groupOf } from "./reconcile.js"
import { textOf } from "./ytext.js"

type Item = { readonly id: string; readonly text: string }

function currentItems(container: Y.XmlElement): Item[] {
  const group = groupOf(container)
  if (!group) return []
  const items: Item[] = []
  for (const child of group.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue
    const id = child.getAttribute("id")
    const content = child.get(0)
    if (typeof id === "string" && content instanceof Y.XmlElement) {
      items.push({ id, text: textOf(content) })
    }
  }
  return items
}

function matchedPairs(
  current: readonly Item[],
  target: readonly string[]
): [number, number][] {
  const table: number[][] = Array.from({ length: current.length + 1 }, () =>
    new Array<number>(target.length + 1).fill(0)
  )
  for (let row = current.length - 1; row >= 0; row--) {
    for (let col = target.length - 1; col >= 0; col--) {
      const same = current[row]?.text === target[col]
      const down = table[row + 1]?.[col] ?? 0
      const across = table[row]?.[col + 1] ?? 0
      const diagonal = table[row + 1]?.[col + 1] ?? 0
      const cell = table[row]
      if (cell) cell[col] = same ? diagonal + 1 : Math.max(down, across)
    }
  }
  const pairs: [number, number][] = []
  let row = 0
  let col = 0
  while (row < current.length && col < target.length) {
    if (current[row]?.text === target[col]) {
      pairs.push([row, col])
      row++
      col++
    } else if ((table[row + 1]?.[col] ?? 0) >= (table[row]?.[col + 1] ?? 0)) {
      row++
    } else {
      col++
    }
  }
  return pairs
}

function textOfItem(item: PaperPartialBlock): string {
  const content: unknown = item.content
  if (!Array.isArray(content)) return ""
  return content.map((part: { text?: string }) => part.text ?? "").join("")
}

function assignIds(skills: PaperPartialBlock, current: readonly Item[]): void {
  const items = skills.children ?? []
  const pairs = matchedPairs(current, items.map(textOfItem))
  const anchors: [number, number][] = [...pairs, [current.length, items.length]]
  let row = 0
  let col = 0
  for (const [anchorRow, anchorCol] of anchors) {
    const gap = current.slice(row, anchorRow)
    items.slice(col, anchorCol).forEach((target, index) => {
      target.id = gap[index]?.id ?? `${skills.id}-${crypto.randomUUID()}`
    })
    const matched = current[anchorRow]
    const target = items[anchorCol]
    if (matched && target) target.id = matched.id
    row = anchorRow + 1
    col = anchorCol + 1
  }
}

export function alignSkillItems(
  root: Y.XmlElement,
  blocks: readonly PaperPartialBlock[]
): void {
  const containers = new Map<string, Y.XmlElement>()
  for (const child of root.toArray()) {
    const id = child instanceof Y.XmlElement ? child.getAttribute("id") : null
    if (child instanceof Y.XmlElement && typeof id === "string") {
      containers.set(id, child)
    }
  }
  for (const block of blocks) {
    const container = block.id ? containers.get(block.id) : undefined
    if (block.type === "paperSkills" && container) {
      assignIds(block, currentItems(container))
    }
  }
}
