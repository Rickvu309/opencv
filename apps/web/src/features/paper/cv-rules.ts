import { createExtension } from "@blocknote/core"
import { Fragment, Slice, type Node, type ResolvedPos } from "prosemirror-model"
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Selection,
} from "prosemirror-state"
import { ySyncPluginKey } from "y-prosemirror"

import {
  HEADING_LEVELS,
  LIST_ITEMS,
  MAX_DEPTH,
  asListItem,
  resetLook,
} from "./letter-rules.ts"

const ENTRY = new Set(["paperExperience", "paperEducation", "paperSkills"])
const SECTION_KINDS = new Set([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "activities",
  "awards",
  "languages",
])
const CV_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "divider",
  "paperHeader",
  "paperSection",
  "paperExperience",
  "paperEducation",
  "paperSkills",
  "paperSkillItem",
])
const HOLDS_LIST = new Set([
  "bulletListItem",
  "numberedListItem",
  "paperExperience",
  "paperEducation",
])

type Hold = "list" | "skill" | "none"
type Counts = { header: number; entry: number; shape: number }
type Top = { id: string; type: string }

function holdOf(kind: string): Hold {
  if (kind === "paperSkills") return "skill"
  if (HOLDS_LIST.has(kind)) return "list"
  return "none"
}

function fieldText(node: Node) {
  const attrs = node.attrs as Record<string, unknown>
  const names = [
    "name",
    "role",
    "company",
    "school",
    "degree",
    "label",
    "email",
    "phone",
    "city",
    "linkedin",
    "period",
    "location",
    "detail",
  ]
  const props = names
    .map((name) => (typeof attrs[name] === "string" ? attrs[name] : ""))
    .filter((part) => part.trim() !== "")
    .join(" ")
  return node.textContent.trim() !== "" ? node.textContent : props
}

function bulletFromText(content: Node) {
  const bullet = content.type.schema.nodes.bulletListItem
  if (!bullet) return content
  const text = fieldText(content)
  return text
    ? bullet.create(null, content.type.schema.text(text))
    : bullet.create()
}

function paragraphWith(container: Node, text: string) {
  const schema = container.type.schema
  const paragraph = schema.nodes.paragraph
  if (!paragraph) return container
  const textNode = text ? schema.text(text) : null
  return container.type.create(container.attrs, [
    paragraph.create(null, textNode),
  ])
}

function asSkillItem(content: Node) {
  const skill = content.type.schema.nodes.paperSkillItem
  if (!skill) return content
  const text = fieldText(content)
  const inline =
    content.content.size > 0
      ? content.content
      : text
        ? Fragment.from(content.type.schema.text(text))
        : undefined
  return skill.create(null, inline)
}

function coerceCvContainers(
  fragment: Fragment,
  depth: number,
  hold: Hold,
  into: Node[]
) {
  fragment.forEach((node) => {
    if (node.type.name === "blockGroup") {
      coerceCvContainers(node.content, depth, hold, into)
      return
    }
    if (node.type.name !== "blockContainer" || node.childCount === 0) {
      into.push(node)
      return
    }
    const container = resetLook(node)
    let content = resetLook(container.child(0))
    const kind = content.type.name
    const stray =
      kind === "paperHeader" ||
      !CV_TYPES.has(kind) ||
      (kind === "paperSkillItem" && hold !== "skill") ||
      (hold === "skill" && kind !== "paperSkillItem")
    if (stray) {
      const plain = paragraphWith(container, fieldText(content))
      const inner = plain.child(0)
      const wrapped =
        hold === "list"
          ? asListItem(inner)
          : hold === "skill"
            ? asSkillItem(inner)
            : inner
      into.push(container.type.create(container.attrs, [wrapped]))
      return
    }
    if (hold === "list" && kind === "divider") return
    if (hold === "list" && !LIST_ITEMS.has(kind))
      content = bulletFromText(content)
    if (kind === "heading" && !HEADING_LEVELS.has(content.attrs.level)) {
      const level = Number(content.attrs.level) <= 2 ? 2 : 3
      content = content.type.create(
        { ...content.attrs, level },
        content.content,
        content.marks
      )
    }
    if (
      kind === "paperSection" &&
      !SECTION_KINDS.has(String(content.attrs.kind))
    ) {
      content = content.type.create(
        { ...content.attrs, kind: "summary" },
        content.content,
        content.marks
      )
    }
    const nextHold = holdOf(content.type.name)
    const nested: Node[] = []
    const lifted: Node[] = []
    if (container.childCount > 1) {
      const found: Node[] = []
      coerceCvContainers(container.child(1).content, depth + 1, nextHold, found)
      for (const kid of found) {
        const kidKind = kid.childCount > 0 ? kid.child(0).type.name : ""
        const keep =
          nextHold === "list"
            ? depth < MAX_DEPTH && LIST_ITEMS.has(kidKind)
            : nextHold === "skill" && kidKind === "paperSkillItem"
        if (keep) nested.push(kid)
        else lifted.push(kid)
      }
    }
    const group = container.type.schema.nodes.blockGroup
    const kids = nested.length > 0 && group ? [group.create(null, nested)] : []
    into.push(container.type.create(container.attrs, [content, ...kids]))
    into.push(...lifted)
  })
}

export function coerceCvPaste(slice: Slice, depth = 1, hold: Hold = "none") {
  const out: Node[] = []
  coerceCvContainers(slice.content, depth, hold, out)
  return new Slice(Fragment.from(out), slice.openStart, slice.openEnd)
}

const PASTE_SKIP = new Set([
  "paperExperience",
  "paperEducation",
  "paperHeader",
  "paperSection",
  "paperSkills",
])

function cvPasteDepth(selectionFrom: ResolvedPos) {
  let found = 0
  for (let level = selectionFrom.depth; level > 0; level -= 1) {
    const node = selectionFrom.node(level)
    if (node.type.name !== "blockContainer" || node.childCount === 0) continue
    if (PASTE_SKIP.has(node.child(0).type.name)) continue
    found += 1
  }
  return Math.max(found, 1)
}

function holdAt(selectionFrom: ResolvedPos): Hold {
  for (let level = selectionFrom.depth; level > 0; level -= 1) {
    const node = selectionFrom.node(level)
    if (node.type.name !== "blockContainer" || node.childCount === 0) continue
    return holdOf(node.child(0).type.name)
  }
  return "none"
}

function topOf(doc: Node): Top[] {
  const out: Top[] = []
  if (doc.childCount === 0) return out
  doc.child(0).forEach((container) => {
    out.push({
      id: String(container.attrs.id ?? ""),
      type: container.childCount > 0 ? container.child(0).type.name : "",
    })
  })
  return out
}

function walkShape(
  container: Node,
  kind: string,
  depth: number,
  counts: Counts
) {
  if (container.childCount < 2) return
  const holdsList = HOLDS_LIST.has(kind)
  const holdsSkill = kind === "paperSkills"
  if (!holdsList && !holdsSkill) {
    counts.shape += 1
    return
  }
  container.child(1).forEach((child) => {
    if (child.childCount === 0) {
      counts.shape += 1
      return
    }
    const inner = child.child(0)
    const innerKind = inner.type.name
    if (depth + 1 > MAX_DEPTH) counts.shape += 1
    if (holdsSkill && innerKind !== "paperSkillItem") counts.shape += 1
    if (holdsList && !LIST_ITEMS.has(innerKind)) counts.shape += 1
    if (innerKind === "heading" && !HEADING_LEVELS.has(inner.attrs.level)) {
      counts.shape += 1
    }
    walkShape(child, innerKind, depth + 1, counts)
  })
}

export function cvCounts(doc: Node): Counts {
  const counts: Counts = { header: 0, entry: 0, shape: 0 }
  const top = topOf(doc)
  if (top.length === 0 || top[0]?.type !== "paperHeader") counts.header += 1
  if (top.filter((item) => item.type === "paperHeader").length !== 1) {
    counts.header += 1
  }
  let seen = false
  for (const item of top) {
    if (item.type === "paperSection") seen = true
    else if (!seen && ENTRY.has(item.type)) counts.entry += 1
    if (item.type === "paperSkillItem") counts.shape += 1
  }
  if (doc.childCount === 0) return counts
  doc.child(0).forEach((container) => {
    if (container.childCount === 0) {
      counts.shape += 1
      return
    }
    const content = container.child(0)
    const kind = content.type.name
    if (kind === "paperHeader" && container.childCount > 1) counts.header += 1
    if (kind === "heading" && !HEADING_LEVELS.has(content.attrs.level)) {
      counts.shape += 1
    }
    if (
      kind === "paperSection" &&
      !SECTION_KINDS.has(String(content.attrs.kind))
    ) {
      counts.shape += 1
    }
    const start =
      kind === "paperExperience" || kind === "paperEducation" ? 0 : 1
    walkShape(container, kind, start, counts)
  })
  return counts
}

type Stepped = {
  docChanged: boolean
  steps?: readonly object[]
  getMeta: (key: string | PluginKey) => unknown
}

function ownChange(transaction: {
  getMeta: (key: string | PluginKey) => unknown
}) {
  return (
    !transaction.getMeta(ySyncPluginKey) &&
    !transaction.getMeta("cv-regroup") &&
    !transaction.getMeta("cv-skill-split")
  )
}

function insertedSections(transaction: Stepped) {
  if (!transaction.docChanged || !ownChange(transaction)) return []
  const ids: string[] = []
  for (const step of transaction.steps ?? []) {
    const slice = (step as { slice?: Slice }).slice
    if (!slice) continue
    slice.content.forEach((node) => {
      if (
        node.type.name === "blockContainer" &&
        node.childCount > 0 &&
        node.child(0).type.name === "paperSection"
      ) {
        ids.push(String(node.attrs.id ?? ""))
      }
    })
  }
  return ids
}

function regroup(oldDoc: Node, newDoc: Node, sectionId: string): Node[] | null {
  const oldTop = topOf(oldDoc)
  const start = oldTop.findIndex((item) => item.id === sectionId)
  if (start < 0) return null
  const group: string[] = []
  for (const item of oldTop.slice(start + 1)) {
    if (item.type === "paperSection" || item.type === "paperHeader") break
    group.push(item.id)
  }
  const next = topOf(newDoc)
  const at = next.findIndex((item) => item.id === sectionId)
  if (at < 0) return null
  const members = new Set(group)
  const desired = [
    ...next.slice(0, at + 1).filter((item) => !members.has(item.id)),
    ...group.flatMap((id) => next.filter((item) => item.id === id)),
    ...next.slice(at + 1).filter((item) => !members.has(item.id)),
  ]
  if (desired.length !== next.length) return null
  if (desired.every((item, index) => item.id === next[index]?.id)) return null
  const blockGroup = newDoc.child(0)
  const byId = new Map<string, Node>()
  blockGroup.forEach((container) => {
    byId.set(String(container.attrs.id ?? ""), container)
  })
  const ordered: Node[] = []
  for (const item of desired) {
    const node = byId.get(item.id)
    if (!node) return null
    ordered.push(node)
  }
  return ordered
}

function differingRange(doc: Node, ordered: Node[]) {
  const current: Node[] = []
  doc.child(0).forEach((node) => current.push(node))
  if (current.length !== ordered.length) return null
  let start = 0
  while (start < current.length && current[start] === ordered[start]) start += 1
  if (start === current.length) return null
  let end = current.length - 1
  while (end > start && current[end] === ordered[end]) end -= 1
  let pos = 1
  const positions: number[] = []
  doc.child(0).forEach((node) => {
    positions.push(pos)
    pos += node.nodeSize
  })
  const from = positions[start]
  if (from === undefined) return null
  const after = positions[end + 1]
  return {
    from,
    to: after ?? pos,
    nodes: ordered.slice(start, end + 1),
  }
}

function placeSectionSelection(
  tr: { doc: Node; setSelection: (selection: Selection) => void },
  sectionId: string
) {
  let at = -1
  tr.doc.descendants((node, pos) => {
    if (at >= 0) return false
    if (
      node.type.name === "blockContainer" &&
      String(node.attrs.id ?? "") === sectionId
    ) {
      at = pos + 1
      return false
    }
  })
  if (at < 0 || at > tr.doc.content.size) return
  tr.setSelection(TextSelection.near(tr.doc.resolve(at)))
}

function skillCommaSplit(doc: Node) {
  const found: { from: number; to: number; nodes: Node[] }[] = []
  doc.descendants((node, pos) => {
    if (found.length > 0) return false
    if (node.type.name !== "blockContainer" || node.childCount === 0) return
    const content = node.child(0)
    if (
      content.type.name !== "paperSkillItem" ||
      !content.textContent.includes(",")
    ) {
      return
    }
    const parts = content.textContent.split(",").map((part) => part.trim())
    if (parts.length < 2) return
    const skill = node.type.schema.nodes.paperSkillItem
    if (!skill) return
    const nodes = parts.map((part, index) => {
      const id = index === 0 ? node.attrs.id : crypto.randomUUID()
      const text = part ? node.type.schema.text(part) : undefined
      return node.type.create({ ...node.attrs, id }, skill.create(null, text))
    })
    found.push({ from: pos, to: pos + node.nodeSize, nodes })
    return false
  })
  return found[0] ?? null
}

export const cvRulesPlugin = new Plugin({
  props: {
    transformPasted: (slice, view) => {
      const from = view.state.selection.$from
      return coerceCvPaste(slice, cvPasteDepth(from), holdAt(from))
    },
  },
  filterTransaction(transaction, state) {
    if (!transaction.docChanged) return true
    if (transaction.getMeta(ySyncPluginKey)) return true
    const next = cvCounts(transaction.doc)
    const prev = cvCounts(state.doc)
    if (next.header > prev.header || next.shape > prev.shape) return false
    if (next.entry > prev.entry && insertedSections(transaction).length !== 1) {
      return false
    }
    return true
  },
  appendTransaction(transactions, oldState, newState) {
    if (
      transactions.some((transaction) => transaction.getMeta(ySyncPluginKey))
    ) {
      return null
    }
    if (
      !transactions.some((transaction) => transaction.getMeta("cv-skill-split"))
    ) {
      const split = skillCommaSplit(newState.doc)
      if (split) {
        const tr = newState.tr.replaceWith(split.from, split.to, split.nodes)
        tr.setMeta("cv-skill-split", true)
        return tr
      }
    }
    if (transactions.some((transaction) => transaction.getMeta("cv-regroup"))) {
      return null
    }
    const ids = [
      ...new Set(
        transactions.flatMap((transaction) => insertedSections(transaction))
      ),
    ]
    if (ids.length !== 1) return null
    const sectionId = ids[0]
    if (!sectionId) return null
    const ordered = regroup(oldState.doc, newState.doc, sectionId)
    if (!ordered) return null
    const range = differingRange(newState.doc, ordered)
    if (!range) return null
    const tr = newState.tr.replaceWith(range.from, range.to, range.nodes)
    tr.setMeta("cv-regroup", true)
    placeSectionSelection(tr, sectionId)
    return tr
  },
})

export const cvRulesExtension = createExtension({
  key: "cvRules",
  prosemirrorPlugins: [cvRulesPlugin],
})
