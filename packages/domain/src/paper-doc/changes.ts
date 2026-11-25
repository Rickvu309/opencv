import type { PaperNodeType } from "./nodes.js"
import { type Index } from "./tree.js"

export type PaperChange = {
  readonly blockId: string
  readonly change: "added" | "changed" | "moved" | "removed"
  readonly kind: PaperNodeType
  readonly before?: string
  readonly after?: string
}

function longestIncreasing(
  values: readonly number[],
  costs: readonly number[]
): Set<number> {
  const best: number[] = values.map(() => 1)
  const cost: number[] = values.map((_value, at) => costs[at] ?? 0)
  const previous: number[] = values.map(() => -1)
  const better = (length: number, price: number, than: number) =>
    length > best[than]! || (length === best[than] && price < cost[than]!)
  let end = -1
  values.forEach((value, index) => {
    for (let before = 0; before < index; before += 1) {
      if (values[before]! >= value) continue
      const length = best[before]! + 1
      const price = cost[before]! + (costs[index] ?? 0)
      if (
        length > best[index]! ||
        (length === best[index] && price < cost[index]!)
      ) {
        best[index] = length
        cost[index] = price
        previous[index] = before
      }
    }
    if (end === -1 || better(best[index]!, cost[index]!, end)) end = index
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

export function movedIds(
  base: Index,
  target: Index,
  stays: ReadonlySet<string> = new Set()
): Set<string> {
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
    const stay = longestIncreasing(
      positions,
      sameOwner.map((id) => (stays.has(id) ? 0 : 1))
    )
    sameOwner.forEach((id, at) => {
      if (!stay.has(at)) moved.add(id)
    })
  }
  return moved
}
