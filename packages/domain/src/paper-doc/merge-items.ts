import type { ListItem } from "./nodes.js"
import { rebaseRuns } from "./merge-text.js"
import { plainTextOfRuns } from "./rich-text.js"

const MAX_DEPTH = 2

type Flat = { readonly item: ListItem; readonly depth: number }

export function flatItems(items: readonly ListItem[], depth = 0): Flat[] {
  return items.flatMap((item) => [
    { item, depth },
    ...flatItems(item.children, depth + 1),
  ])
}

export function mergeItems(
  current: readonly ListItem[],
  sent: readonly ListItem[]
): ListItem[] {
  const flat = flatItems(current)
  const byId = new Map(flat.map((entry) => [entry.item.id as string, entry]))
  const sentIds = new Set(sent.map((item) => item.id as string))
  const keptOrder = flat
    .filter((entry) => sentIds.has(entry.item.id))
    .map((entry) => entry.item.id)
  const sentOrder = sent.filter((item) => byId.has(item.id)).map((i) => i.id)
  const reordered = keptOrder.join("\u0000") !== sentOrder.join("\u0000")

  const depthAfterDeletes = new Map<string, number>()
  const walk = (items: readonly ListItem[], depth: number, shift: number) => {
    for (const item of items) {
      const gone = !sentIds.has(item.id)
      if (!gone) depthAfterDeletes.set(item.id, depth - shift)
      walk(item.children, depth + 1, gone ? shift + 1 : shift)
    }
  }
  walk(current, 0, 0)

  const roots: ListItem[] = []
  const stack: ListItem[] = []
  let previous = -1
  for (const entry of sent) {
    const known = byId.get(entry.id)?.item
    const text = plainTextOfRuns(entry.content)
    const node: ListItem = {
      id: entry.id,
      type: entry.type,
      content: known ? rebaseRuns(known.content, text) : entry.content,
      children: [],
    }
    const wanted = reordered
      ? 0
      : known
        ? (depthAfterDeletes.get(entry.id) ?? 0)
        : Math.max(previous, 0)
    const depth = Math.max(0, Math.min(wanted, previous + 1, MAX_DEPTH))
    const parent = stack[depth - 1]
    if (depth === 0 || !parent) roots.push(node)
    else parent.children.push(node)
    stack[depth] = node
    stack.length = depth + 1
    previous = depth
  }
  return roots
}
