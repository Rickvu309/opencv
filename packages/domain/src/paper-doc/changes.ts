import type { PaperDocument } from "./document.js"
import type { PaperNode, PaperNodeType } from "./nodes.js"
import { nodeSummary } from "./outline.js"
import { canonical, indexOf, type Entry, type Index } from "./tree.js"

export type PaperChange = {
  readonly blockId: string
  readonly change: "added" | "changed" | "moved" | "removed"
  readonly kind: PaperNodeType
  readonly before?: string
  readonly after?: string
}

function ownFields(node: PaperNode): unknown {
  return "children" in node ? { ...node, children: [] } : node
}

function summaryOf(node: PaperNode): string {
  return nodeSummary(ownFields(node) as PaperNode, 1)
}

function longestIncreasing(values: readonly number[]): Set<number> {
  const best: number[] = values.map(() => 1)
  const previous: number[] = values.map(() => -1)
  let end = -1
  values.forEach((value, index) => {
    for (let before = 0; before < index; before += 1) {
      if (values[before]! < value && best[before]! + 1 > best[index]!) {
        best[index] = best[before]! + 1
        previous[index] = before
      }
    }
    if (end === -1 || best[index]! > best[end]!) end = index
  })
  const keep = new Set<number>()
  for (let at = end; at !== -1; at = previous[at]!) keep.add(at)
  return keep
}

function idsByOwner(index: Index, common: ReadonlySet<string>) {
  const owners = new Map<string, string[]>()
  for (const [id, entry] of index) {
    if (!common.has(id)) continue
    const ids = owners.get(entry.owner) ?? []
    ids.push(id)
    owners.set(entry.owner, ids)
  }
  return owners
}

function movedIds(base: Index, target: Index): Set<string> {
  const moved = new Set<string>()
  const common = new Set([...target.keys()].filter((id) => base.has(id)))
  for (const id of common) {
    if (base.get(id)!.owner !== target.get(id)!.owner) moved.add(id)
  }
  const inBase = idsByOwner(base, common)
  for (const [owner, targetIds] of idsByOwner(target, common)) {
    const baseIds = (inBase.get(owner) ?? []).filter(
      (id) => !moved.has(id) && target.get(id)!.owner === owner
    )
    const sameOwner = targetIds.filter((id) => baseIds.includes(id))
    const positions = sameOwner.map((id) => baseIds.indexOf(id))
    const stay = longestIncreasing(positions)
    sameOwner.forEach((id, at) => {
      if (!stay.has(at)) moved.add(id)
    })
  }
  return moved
}

function changeOf(
  id: string,
  base: Entry | undefined,
  target: Entry | undefined,
  moved: ReadonlySet<string>
): PaperChange | null {
  if (!base && target) {
    return {
      blockId: id,
      change: "added",
      kind: target.node.type,
      after: summaryOf(target.node),
    }
  }
  if (base && !target) {
    return {
      blockId: id,
      change: "removed",
      kind: base.node.type,
      before: summaryOf(base.node),
    }
  }
  if (!base || !target) return null
  if (canonical(ownFields(base.node)) !== canonical(ownFields(target.node))) {
    return {
      blockId: id,
      change: "changed",
      kind: target.node.type,
      before: summaryOf(base.node),
      after: summaryOf(target.node),
    }
  }
  if (moved.has(id)) {
    return {
      blockId: id,
      change: "moved",
      kind: target.node.type,
      after: summaryOf(target.node),
    }
  }
  return null
}

export function paperChanges(
  base: PaperDocument,
  target: PaperDocument
): PaperChange[] {
  const before = indexOf(base)
  const after = indexOf(target)
  const moved = movedIds(before, after)
  const changes: PaperChange[] = []
  for (const [id, entry] of after) {
    const change = changeOf(id, before.get(id), entry, moved)
    if (change) changes.push(change)
  }
  for (const [id, entry] of before) {
    if (!after.has(id)) {
      const change = changeOf(id, entry, undefined, moved)
      if (change) changes.push(change)
    }
  }
  return changes
}
