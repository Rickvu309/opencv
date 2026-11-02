import { paperChanges } from "./changes.js"
import { paperDocumentSchema, type PaperDocument } from "./document.js"
import type { PaperNode } from "./nodes.js"
import {
  canonical,
  childrenOf,
  cloned,
  fieldsOf,
  indexOf,
  type Entry,
  type Index,
} from "./tree.js"

type UndoReading = {
  readonly reverted: PaperDocument | null
  readonly stripped: PaperDocument | null
  readonly broken: ReadonlySet<string>
}

export type UndoPlan =
  | {
      readonly ok: true
      readonly target: PaperDocument
      readonly moved: ReadonlySet<string>
    }
  | { readonly ok: false; readonly reason: string }

const YOURS = "You changed this since the Coach's edit, so it cannot be undone"
const WORDS =
  "You changed the Coach's words since, so Undo would damage your text"

class Refusal extends Error {}

function refuse(reason: string): never {
  throw new Refusal(reason)
}

function listOf(work: PaperDocument, owner: string, index: Index) {
  if (owner === "body") return work.blocks as PaperNode[]
  const holder = index.get(owner)
  const kids = holder ? childrenOf(holder.node) : null
  return kids ?? refuse("Where this block was no longer exists")
}

function neighbourPlace(entry: Entry, other: Index): string {
  const at = entry.list ? entry.list.indexOf(entry.node) : -1
  for (let i = at - 1; i >= 0; i -= 1) {
    const sibling = entry.list![i]!
    if (other.has(sibling.id)) return `${entry.owner}/${sibling.id}`
  }
  return `${entry.owner}/@start`
}

function textKey(key: string) {
  return key === "title" ? "title" : "content"
}

function restoreFields(
  node: PaperNode,
  pre: Entry,
  post: Entry,
  reading: UndoReading,
  rebuilt: ReadonlySet<string>
): void {
  const target = node as unknown as Record<string, unknown>
  const preFields = fieldsOf(pre.node, false)
  const postFields = fieldsOf(post.node, false)
  const liveFields = fieldsOf(node, false)
  const reverted = reading.reverted ? indexOf(reading.reverted) : null
  for (const key of Object.keys(postFields.text)) {
    if ((preFields.text[key] ?? "") === postFields.text[key]) continue
    const field = textKey(key)
    const sameRuns =
      canonical(target[field]) ===
      canonical((post.node as unknown as Record<string, unknown>)[field])
    if (liveFields.text[key] === postFields.text[key] && sameRuns) {
      target[field] = cloned(
        (pre.node as unknown as Record<string, unknown>)[field]
      )
      continue
    }
    if (reading.broken.has(node.id)) refuse(WORDS)
    if (rebuilt.has(node.id)) refuse(YOURS)
    const source = reverted?.get(node.id)
    if (!source) refuse(YOURS)
    target[field] = cloned(
      (source.node as unknown as Record<string, unknown>)[field]
    )
  }
  const preRecord = pre.node as unknown as Record<string, unknown>
  for (const key of Object.keys(postFields.props)) {
    if (preFields.props[key] === postFields.props[key]) continue
    if (liveFields.props[key] === postFields.props[key]) {
      target[key] = cloned(preRecord[key])
    }
  }
}

function stripCreated(
  work: PaperDocument,
  post: Index,
  pre: Index,
  reading: UndoReading
): void {
  const created = [...post.keys()].filter((id) => !pre.has(id))
  const depth = (id: string): number => {
    const owner = post.get(id)!.owner
    return owner === "body" || !post.has(owner) ? 0 : 1 + depth(owner)
  }
  created.sort((a, b) => depth(b) - depth(a))
  const stripped = reading.stripped ? indexOf(reading.stripped) : null
  for (const id of created) {
    const entry = indexOf(work).get(id)
    if (!entry) continue
    const original = post.get(id)!
    const now = fieldsOf(entry.node, false)
    const then = fieldsOf(original.node, false)
    for (const [key, value] of Object.entries(now.props)) {
      if (then.props[key] !== value) refuse(YOURS)
    }
    let remaining = false
    const target = entry.node as unknown as Record<string, unknown>
    for (const key of Object.keys(now.text)) {
      const field = textKey(key)
      if (now.text[key] === then.text[key]) {
        target[field] = field === "title" ? "" : []
        continue
      }
      const source = stripped?.get(id)
      if (!source) refuse(YOURS)
      target[field] = cloned(
        (source.node as unknown as Record<string, unknown>)[field]
      )
      if (fieldsOf(source.node, false).text[key]) remaining = true
    }
    const kids = childrenOf(entry.node) ?? []
    const propsOnly = Object.keys(now.text).length === 0
    if (kids.length > 0 && propsOnly) refuse(YOURS)
    if (!remaining && kids.length === 0) {
      entry.list!.splice(entry.list!.indexOf(entry.node), 1)
    }
  }
}

function withoutPresent(node: PaperNode, present: Index): PaperNode {
  const kids = childrenOf(node)
  if (kids) {
    const kept = kids
      .filter((kid) => !present.has(kid.id))
      .map((kid) => withoutPresent(kid, present))
    ;(node as unknown as { children: PaperNode[] }).children = kept
  }
  return node
}

function putBack(work: PaperDocument, pre: Index, post: Index): void {
  const removed = [...pre.keys()].filter(
    (id) => !post.has(id) && !indexOf(work).has(id)
  )
  for (const id of removed) {
    const original = pre.get(id)!
    const parentRemoved = removed.includes(original.owner)
    if (parentRemoved) continue
    const list = listOf(work, original.owner, indexOf(work))
    const siblings = original.list ?? []
    let at = 0
    for (let i = siblings.indexOf(original.node) - 1; i >= 0; i -= 1) {
      const found = list.findIndex((item) => item.id === siblings[i]!.id)
      if (found !== -1) {
        at = found + 1
        break
      }
    }
    list.splice(at, 0, withoutPresent(cloned(original.node), indexOf(work)))
  }
}

function moveBack(
  work: PaperDocument,
  pre: Index,
  post: Index,
  live: Index,
  movedIds: readonly string[],
  moved: Set<string>,
  deferred: string[] | null
): void {
  for (const id of movedIds) {
    const inLive = live.get(id)
    const inPost = post.get(id)
    const inPre = pre.get(id)
    if (!inLive || !inPost || !inPre) continue
    if (neighbourPlace(inLive, post) !== neighbourPlace(inPost, live)) {
      refuse(YOURS)
    }
    const current = indexOf(work)
    if (deferred && inPre.owner !== "body" && !current.has(inPre.owner)) {
      deferred.push(id)
      continue
    }
    const entry = current.get(id)!
    entry.list!.splice(entry.list!.indexOf(entry.node), 1)
    const list = listOf(work, inPre.owner, indexOf(work))
    const siblings = inPre.list ?? []
    let at = 0
    for (let i = siblings.indexOf(inPre.node) - 1; i >= 0; i -= 1) {
      const found = list.findIndex((item) => item.id === siblings[i]!.id)
      if (found !== -1) {
        at = found + 1
        break
      }
    }
    list.splice(at, 0, entry.node)
    moved.add(id)
  }
}

export function undoCoachEdit(
  pre: PaperDocument,
  post: PaperDocument,
  live: PaperDocument,
  reading: UndoReading
): UndoPlan {
  try {
    const before = indexOf(pre)
    const edited = indexOf(post)
    const now = indexOf(live)
    const work = cloned(live)
    const movedIds = paperChanges(pre, post)
      .filter((change) => change.change === "moved")
      .map((change) => change.blockId)
    const rebuilt = new Set(movedIds)
    for (const [id, p] of before) {
      const q = edited.get(id)
      const entry = indexOf(work).get(id)
      if (!q || !entry) continue
      if (canonical(p.node) === canonical(q.node)) continue
      restoreFields(entry.node, p, q, reading, rebuilt)
    }
    stripCreated(work, edited, before, reading)
    const moved = new Set<string>()
    const deferred: string[] = []
    moveBack(work, before, edited, now, movedIds, moved, deferred)
    putBack(work, before, edited)
    moveBack(work, before, edited, now, deferred, moved, null)
    const parsed = paperDocumentSchema.safeParse(work)
    if (!parsed.success) {
      return {
        ok: false,
        reason: parsed.error.issues[0]?.message ?? "The result is not valid",
      }
    }
    return { ok: true, target: work, moved }
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, reason: error.message }
    throw error
  }
}
