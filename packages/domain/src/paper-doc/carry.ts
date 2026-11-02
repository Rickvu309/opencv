import type { PaperDocument } from "./document.js"
import type { PaperNode } from "./nodes.js"
import { rebaseRuns } from "./merge-text.js"
import { inverseText } from "./text-align.js"
import {
  canonical,
  childrenOf,
  cloned,
  fieldsOf,
  indexOf,
  type Index,
} from "./tree.js"

function replayChange(base: string, person: string, ours: string) {
  return inverseText(person, base, ours)
}

function carryFields(
  target: PaperNode,
  base: PaperNode,
  intended: PaperNode
): boolean {
  const was = fieldsOf(base, false)
  const wanted = fieldsOf(intended, false)
  const now = fieldsOf(target, false)
  const record = target as unknown as Record<string, unknown>
  for (const key of Object.keys(wanted.text)) {
    if ((was.text[key] ?? "") === wanted.text[key]) continue
    const merged = replayChange(
      was.text[key] ?? "",
      wanted.text[key]!,
      now.text[key] ?? ""
    )
    if (merged === null) return false
    if (merged === now.text[key]) continue
    if (key === "title") {
      record.title = merged
    } else {
      record.content = rebaseRuns((record.content ?? []) as never, merged)
    }
  }
  const source = intended as unknown as Record<string, unknown>
  for (const key of Object.keys(wanted.props)) {
    if (was.props[key] !== wanted.props[key]) record[key] = cloned(source[key])
  }
  return true
}

function withoutPresent(node: PaperNode, present: Index): PaperNode {
  const kids = childrenOf(node)
  if (kids) {
    ;(node as unknown as { children: PaperNode[] }).children = kids
      .filter((kid) => !present.has(kid.id))
      .map((kid) => withoutPresent(kid, present))
  }
  return node
}

function placeIn(
  work: PaperDocument,
  intended: Index,
  id: string,
  node: PaperNode
) {
  const entry = intended.get(id)!
  const present = indexOf(work)
  const holder = entry.owner === "body" ? undefined : present.get(entry.owner)
  const list =
    (holder ? childrenOf(holder.node) : null) ?? (work.blocks as PaperNode[])
  const siblings = entry.list ?? []
  let at = 0
  for (let i = siblings.indexOf(entry.node) - 1; i >= 0; i -= 1) {
    const found = list.findIndex((item) => item.id === siblings[i]!.id)
    if (found !== -1) {
      at = found + 1
      break
    }
  }
  list.splice(at, 0, node)
}

function ensureChain(work: PaperDocument, intended: Index, id: string): void {
  const entry = intended.get(id)
  if (!entry || entry.owner === "body" || indexOf(work).has(entry.owner)) return
  if (!intended.has(entry.owner)) return
  ensureChain(work, intended, entry.owner)
  const shell = cloned(intended.get(entry.owner)!.node)
  ;(shell as unknown as { children?: PaperNode[] }).children = []
  placeIn(work, intended, entry.owner, shell)
}

function insertPersonBlock(
  work: PaperDocument,
  intended: Index,
  id: string
): void {
  ensureChain(work, intended, id)
  const entry = intended.get(id)!
  placeIn(work, intended, id, withoutPresent(cloned(entry.node), indexOf(work)))
}

function freshId(work: PaperDocument, id: string): string {
  const present = indexOf(work)
  for (let n = 1; ; n += 1) {
    const candidate = `${id}-mine${n === 1 ? "" : n}`
    if (!present.has(candidate)) return candidate
  }
}

function keepBesideLive(
  work: PaperDocument,
  target: PaperNode,
  copy: PaperNode
) {
  const entry = indexOf(work).get(target.id)!
  const mine = cloned(copy)
  ;(mine as unknown as { id: string }).id = freshId(work, target.id)
  if ("children" in mine)
    (mine as unknown as { children: PaperNode[] }).children = []
  entry.list!.splice(entry.list!.indexOf(entry.node) + 1, 0, mine)
}

export function carryPersonChange(
  clientBase: PaperDocument,
  intended: PaperDocument,
  live: PaperDocument,
  owners: ReadonlySet<string>
): PaperDocument | null {
  const base = indexOf(clientBase)
  const wanted = indexOf(intended)
  const work = cloned(live)
  const missing: string[] = []
  for (const id of owners) {
    const b = base.get(id)
    const i = wanted.get(id)
    if (!b || !i) continue
    if (
      canonical(fieldsOf(b.node, false)) === canonical(fieldsOf(i.node, false))
    ) {
      continue
    }
    const target = indexOf(work).get(id)
    if (!target) {
      missing.push(id)
      continue
    }
    if (!carryFields(target.node, b.node, i.node)) {
      keepBesideLive(work, target.node, i.node)
    }
  }
  for (const id of missing) {
    if (!indexOf(work).has(id)) insertPersonBlock(work, wanted, id)
  }
  for (const [id] of wanted) {
    if (base.has(id) || indexOf(work).has(id)) continue
    insertPersonBlock(work, wanted, id)
  }
  return canonical(work) === canonical(live) ? null : work
}
