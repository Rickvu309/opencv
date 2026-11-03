import { paperNodeSpecs, type PaperNodeType } from "./nodes.js"
import type { TextRun } from "./rich-text.js"
import { canonical, cloned } from "./tree.js"

export type Mut = Record<string, unknown> & {
  id: string
  type: string
  content?: TextRun[]
  children?: Mut[]
}

const NOT_OWN = new Set(["id", "content", "children"])

function ownOf(node: Mut): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(node).filter(([key]) => !NOT_OWN.has(key))
  )
}

export function sameText(a: Mut, b: Mut): boolean {
  return canonical(a.content ?? null) === canonical(b.content ?? null)
}

export function sameOwn(a: Mut, b: Mut): boolean {
  return canonical(ownOf(a)) === canonical(ownOf(b)) && sameText(a, b)
}

export function keptOver(base: Mut, changed: Mut): boolean {
  return base.content === undefined
    ? sameOwn(base, changed)
    : sameText(base, changed)
}

export function copyOf(node: Mut): Mut {
  const copy = cloned(node)
  if ("children" in copy) copy.children = []
  return copy
}

export function mergedFields(
  base: Mut | undefined,
  ours: Mut,
  theirs: Mut
): Record<string, unknown> {
  const mine = ownOf(ours)
  const other = ownOf(theirs)
  const before = base ? ownOf(base) : null
  const out: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(mine), ...Object.keys(other)])) {
    const personChanged =
      before === null || canonical(before[key]) !== canonical(mine[key])
    const source = personChanged ? mine : other
    if (key in source) out[key] = cloned(source[key])
  }
  return out
}

export function fittedToType(
  fields: Record<string, unknown>,
  id: string,
  sides: readonly Mut[]
): Record<string, unknown> {
  const type = String(fields.type)
  if (!Object.hasOwn(paperNodeSpecs, type)) return fields
  const spec = paperNodeSpecs[type as PaperNodeType]
  const blank = spec.blank(id as never) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(blank)) {
    if (NOT_OWN.has(key)) continue
    if (key in fields) {
      out[key] = fields[key]
      continue
    }
    const donor = sides.find((side) => side.type === type && key in side)
    out[key] = cloned(donor ? donor[key] : blank[key])
  }
  return out
}

export function unusedId(used: Set<string>, id: string) {
  let n = 1
  while (used.has(`${id}-p${n}`)) n += 1
  const fresh = `${id}-p${n}`
  used.add(fresh)
  return fresh
}

type Located = { list: Mut[]; at: number }

export function locate(blocks: Mut[], id: string): Located | null {
  for (let at = 0; at < blocks.length; at += 1) {
    const node = blocks[at]!
    if (node.id === id) return { list: blocks, at }
    if (node.children) {
      const found = locate(node.children, id)
      if (found) return found
    }
  }
  return null
}
