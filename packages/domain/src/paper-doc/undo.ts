import { paperChanges } from "./changes.js"
import { paperDocumentSchema, type PaperDocument } from "./document.js"
import type { PaperNode } from "./nodes.js"
import { richTextFromInlineMarkdown } from "./rich-text.js"
import { inverseText } from "./text-align.js"
import {
  canonical,
  childrenOf,
  cloned,
  fieldsOf,
  indexOf,
  type Entry,
  type Index,
} from "./tree.js"

export type UndoPlan =
  | {
      readonly ok: true
      readonly target: PaperDocument
      readonly moved: ReadonlySet<string>
    }
  | { readonly ok: false; readonly reason: string }

const YOURS = "You changed this since the Coach's edit, so it cannot be undone"

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

function restoreFields(node: PaperNode, pre: Entry, post: Entry): void {
  const target = node as unknown as Record<string, unknown>
  const preFields = fieldsOf(pre.node, true)
  const postFields = fieldsOf(post.node, true)
  const liveFields = fieldsOf(node, true)
  for (const key of Object.keys(postFields.text)) {
    const before = preFields.text[key] ?? ""
    const edited = postFields.text[key]!
    if (before === edited) continue
    const now = liveFields.text[key] ?? ""
    const original = (pre.node as unknown as Record<string, unknown>)[
      key === "title" ? "title" : "content"
    ]
    if (now === edited) {
      target[key === "title" ? "title" : "content"] = cloned(original)
      continue
    }
    const back = inverseText(before, edited, now)
    if (back === null) refuse("This block is too long to undo safely")
    target[key === "title" ? "title" : "content"] =
      key === "title" ? back : richTextFromInlineMarkdown(back)
  }
  const preRecord = pre.node as unknown as Record<string, unknown>
  for (const key of Object.keys(postFields.props)) {
    if (preFields.props[key] === postFields.props[key]) continue
    if (liveFields.props[key] === postFields.props[key]) {
      target[key] = cloned(preRecord[key])
    }
  }
}

function stripCreated(work: PaperDocument, post: Index, pre: Index): void {
  const created = [...post.keys()].filter((id) => !pre.has(id))
  const depth = (id: string): number => {
    const owner = post.get(id)!.owner
    return owner === "body" || !post.has(owner) ? 0 : 1 + depth(owner)
  }
  created.sort((a, b) => depth(b) - depth(a))
  for (const id of created) {
    const entry = indexOf(work).get(id)
    if (!entry) continue
    const original = post.get(id)!
    const now = fieldsOf(entry.node, true)
    const then = fieldsOf(original.node, true)
    for (const [key, value] of Object.entries(now.props)) {
      if (then.props[key] !== value) refuse(YOURS)
    }
    let remaining = false
    const target = entry.node as unknown as Record<string, unknown>
    for (const [key, value] of Object.entries(now.text)) {
      const stripped = inverseText("", then.text[key] ?? "", value)
      if (stripped === null) refuse("This block is too long to undo safely")
      if (stripped) remaining = true
      target[key === "title" ? "title" : "content"] =
        key === "title" ? stripped : richTextFromInlineMarkdown(stripped)
    }
    const kids = childrenOf(entry.node) ?? []
    const propsOnly = Object.keys(now.text).length === 0
    if (kids.length > 0 && propsOnly) refuse(YOURS)
    if (!remaining && kids.length === 0) {
      entry.list!.splice(entry.list!.indexOf(entry.node), 1)
    }
  }
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
    list.splice(at, 0, cloned(original.node))
  }
}

function moveBack(
  work: PaperDocument,
  pre: Index,
  post: Index,
  live: Index,
  movedIds: readonly string[],
  moved: Set<string>
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
  live: PaperDocument
): UndoPlan {
  try {
    const before = indexOf(pre)
    const edited = indexOf(post)
    const now = indexOf(live)
    const work = cloned(live)
    for (const [id, p] of before) {
      const q = edited.get(id)
      const entry = indexOf(work).get(id)
      if (!q || !entry) continue
      if (canonical(p.node) === canonical(q.node)) continue
      restoreFields(entry.node, p, q)
    }
    stripCreated(work, edited, before)
    const movedIds = paperChanges(pre, post)
      .filter((change) => change.change === "moved")
      .map((change) => change.blockId)
    const moved = new Set<string>()
    moveBack(work, before, edited, now, movedIds, moved)
    putBack(work, before, edited)
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
