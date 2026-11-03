import { createExtension } from "@blocknote/core"
import { Fragment, Slice, type Node, type ResolvedPos } from "prosemirror-model"
import { Plugin } from "prosemirror-state"
import { ySyncPluginKey } from "y-prosemirror"

import { LIST_TYPES } from "./list-block-ops.ts"
import {
  HEADING_LEVELS,
  LIST_ITEMS,
  MAX_DEPTH,
  asListItem,
  insertionDepth,
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

type Run = {
  type: string
  text?: string
  styles?: Record<string, boolean>
  href?: string
  content?: Run[]
}

type LooseBlock = {
  id: string
  type: string
  props: Record<string, unknown>
  content: unknown
  children: LooseBlock[]
}

type LooseEditor = {
  document: LooseBlock[]
  getBlock: (id: string) => LooseBlock | undefined
  getParentBlock: (block: LooseBlock) => LooseBlock | undefined
  getTextCursorPosition: () => { block: LooseBlock }
  prosemirrorState: {
    selection: { empty: boolean; $from: { parentOffset: number } }
  }
  updateBlock: (id: string, update: unknown) => void
  insertBlocks: (
    blocks: unknown[],
    ref: unknown,
    placement: "before" | "after" | "first-child" | "last-child"
  ) => LooseBlock[]
  removeBlocks: (blocks: unknown[]) => void
  setTextCursorPosition: (ref: unknown, pos: "start" | "end") => void
  unnestBlock: () => void
  transact: (fn: () => void) => void
}

function loose(source: object) {
  return source as unknown as LooseEditor
}

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
    if (hold === "list" && !LIST_ITEMS.has(kind)) content = asListItem(content)
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
    walkShape(container, kind, 1, counts)
  })
  return counts
}

export function soleMovedSection(oldDoc: Node, newDoc: Node) {
  const oldTop = topOf(oldDoc)
  const newTop = topOf(newDoc)
  if (oldTop.length === 0 || oldTop.length !== newTop.length) return null
  if (oldTop.every((item, index) => item.id === newTop[index]?.id)) return null
  const oldIds = oldTop.map((item) => item.id)
  const newIds = newTop.map((item) => item.id)
  const typeOf = new Map(oldTop.map((item) => [item.id, item.type]))
  const candidates: string[] = []
  for (const id of oldIds) {
    const withoutOld = oldIds.filter((item) => item !== id)
    const withoutNew = newIds.filter((item) => item !== id)
    if (withoutOld.every((item, index) => item === withoutNew[index])) {
      candidates.push(id)
    }
  }
  const sections = candidates.filter((id) => typeOf.get(id) === "paperSection")
  return sections.length === 1 ? sections[0]! : null
}

function regroup(oldDoc: Node, newDoc: Node, sectionId: string) {
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
  return blockGroup.type.create(blockGroup.attrs, ordered)
}

export const cvRulesPlugin = new Plugin({
  props: {
    transformPasted: (slice, view) => {
      const from = view.state.selection.$from
      return coerceCvPaste(slice, insertionDepth(from), holdAt(from))
    },
  },
  filterTransaction(transaction, state) {
    if (!transaction.docChanged) return true
    if (transaction.getMeta(ySyncPluginKey)) return true
    const next = cvCounts(transaction.doc)
    const prev = cvCounts(state.doc)
    if (next.header > prev.header || next.shape > prev.shape) return false
    if (
      next.entry > prev.entry &&
      !soleMovedSection(state.doc, transaction.doc)
    ) {
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
    const sectionId = soleMovedSection(oldState.doc, newState.doc)
    if (!sectionId) return null
    const next = regroup(oldState.doc, newState.doc, sectionId)
    if (!next) return null
    return newState.tr.replaceWith(0, newState.doc.content.size, next)
  },
})

export const cvRulesExtension = createExtension({
  key: "cvRules",
  prosemirrorPlugins: [cvRulesPlugin],
})

function runsOf(content: unknown): Run[] {
  if (typeof content === "string") {
    return content ? [{ type: "text", text: content, styles: {} }] : []
  }
  if (!Array.isArray(content)) return []
  return content as Run[]
}

function runLength(run: Run): number {
  if (run.type === "link" && Array.isArray(run.content)) {
    return run.content.reduce((sum, item) => sum + runLength(item), 0)
  }
  return run.text?.length ?? 0
}

export function splitRuns(content: unknown, offset: number): [Run[], Run[]] {
  const left: Run[] = []
  const right: Run[] = []
  let rest = offset
  for (const run of runsOf(content)) {
    const size = runLength(run)
    if (rest >= size) {
      left.push(run)
      rest -= size
      continue
    }
    if (run.type === "link" && Array.isArray(run.content)) {
      const [nestedLeft, nestedRight] = splitRuns(run.content, rest)
      if (nestedLeft.length > 0) left.push({ ...run, content: nestedLeft })
      if (nestedRight.length > 0) right.push({ ...run, content: nestedRight })
      rest = 0
      continue
    }
    const text = run.text ?? ""
    if (rest > 0) left.push({ ...run, text: text.slice(0, rest) })
    right.push({ ...run, text: text.slice(rest) })
    rest = 0
  }
  return [left, right]
}

function filled(content: unknown) {
  return runsOf(content).some((run) => runLength(run) > 0)
}

function parentEntry(editor: LooseEditor, block: LooseBlock) {
  const parent = editor.getParentBlock(block)
  if (!parent) return null
  if (parent.type !== "paperExperience" && parent.type !== "paperEducation") {
    return null
  }
  return parent
}

function joinEntryBullet(editor: LooseEditor) {
  const { selection } = editor.prosemirrorState
  if (!selection.empty || selection.$from.parentOffset !== 0) return false
  const block = editor.getTextCursorPosition().block
  if (!LIST_TYPES.has(block.type)) return false
  const parent = parentEntry(editor, block)
  if (!parent) return false
  const siblings = parent.children.filter((item) => LIST_TYPES.has(item.type))
  const index = siblings.findIndex((item) => item.id === block.id)
  if (index < 0) return false
  if (index === 0) {
    if (filled(block.content)) return true
    editor.removeBlocks([block])
    return true
  }
  const prev = siblings[index - 1]!
  const content = [...runsOf(prev.content), ...runsOf(block.content)]
  editor.transact(() => {
    editor.updateBlock(prev.id, { content })
    if (block.children.length > 0) {
      editor.insertBlocks(block.children, prev.id, "last-child")
    }
    editor.removeBlocks([block])
  })
  editor.setTextCursorPosition(prev.id, "end")
  return true
}

function joinSkill(editor: LooseEditor) {
  const { selection } = editor.prosemirrorState
  if (!selection.empty || selection.$from.parentOffset !== 0) return false
  const block = editor.getTextCursorPosition().block
  if (block.type !== "paperSkillItem") return false
  const parent = editor.getParentBlock(block)
  if (!parent || parent.type !== "paperSkills") return false
  const index = parent.children.findIndex((item) => item.id === block.id)
  if (index < 0) return false
  if (index === 0) {
    if (!filled(block.content)) editor.removeBlocks([block])
    return true
  }
  const prev = parent.children[index - 1]!
  if (prev.type !== "paperSkillItem") return false
  const content = [...runsOf(prev.content), ...runsOf(block.content)]
  editor.transact(() => {
    editor.updateBlock(prev.id, { content })
    editor.removeBlocks([block])
  })
  editor.setTextCursorPosition(prev.id, "end")
  return true
}

function splitSkill(editor: LooseEditor) {
  const { selection } = editor.prosemirrorState
  if (!selection.empty) return false
  const block = editor.getTextCursorPosition().block
  if (block.type !== "paperSkillItem") return false
  const [left, right] = splitRuns(block.content, selection.$from.parentOffset)
  let created: LooseBlock[] = []
  editor.transact(() => {
    editor.updateBlock(block.id, { content: left })
    created = editor.insertBlocks(
      [{ type: "paperSkillItem", content: right }],
      block.id,
      "after"
    )
  })
  const next = created[0]
  if (next) editor.setTextCursorPosition(next.id, "start")
  return true
}

function emptyEntryEnter(editor: LooseEditor) {
  const block = editor.getTextCursorPosition().block
  if (block.type === "paperSection") {
    const created = editor.insertBlocks(
      [{ type: "paragraph" }],
      block.id,
      "after"
    )
    const next = created[0]
    if (next) editor.setTextCursorPosition(next.id, "start")
    return true
  }
  if (!LIST_TYPES.has(block.type) || filled(block.content)) return false
  if (!parentEntry(editor, block)) return false
  if (block.children.length > 0) editor.unnestBlock()
  else editor.removeBlocks([block])
  return true
}

function copyBlock(block: LooseBlock): Record<string, unknown> {
  const copy: Record<string, unknown> = {
    type: block.type,
    props: block.props,
  }
  if (block.content !== undefined) copy.content = block.content
  if (block.children.length > 0) {
    copy.children = block.children.map((child) => copyBlock(child))
  }
  return copy
}

export function duplicateCvBlock(source: object) {
  const editor = loose(source)
  let block: LooseBlock
  try {
    block = editor.getTextCursorPosition().block
  } catch {
    return
  }
  if (block.type === "paperHeader") return
  editor.insertBlocks([copyBlock(block)], block.id, "after")
}

type KeyLike = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  target: EventTarget | null
  preventDefault: () => void
  stopPropagation: () => void
  nativeEvent: { isComposing: boolean }
}

export function handleCvKey(source: object, event: KeyLike) {
  const target = event.target
  const typing =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
  const command =
    (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
  if (command && event.key.toLowerCase() === "d") {
    event.preventDefault()
    event.stopPropagation()
    duplicateCvBlock(source)
    return true
  }
  if (typing) return false
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (event.nativeEvent.isComposing) return false
  const editor = loose(source)
  let block: LooseBlock
  try {
    block = editor.getTextCursorPosition().block
  } catch {
    return false
  }
  if (event.key === "," && block.type === "paperSkillItem") {
    event.preventDefault()
    event.stopPropagation()
    return splitSkill(editor)
  }
  if (event.key === "Backspace" && !event.shiftKey) {
    if (joinSkill(editor) || joinEntryBullet(editor)) {
      event.preventDefault()
      event.stopPropagation()
      return true
    }
    return false
  }
  if (event.key !== "Enter" || event.shiftKey) return false
  if (block.type === "paperSkillItem") {
    event.preventDefault()
    event.stopPropagation()
    return splitSkill(editor)
  }
  if (!emptyEntryEnter(editor)) return false
  event.preventDefault()
  event.stopPropagation()
  return true
}
