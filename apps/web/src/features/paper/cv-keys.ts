import { TextSelection } from "prosemirror-state"

import { LIST_TYPES } from "./list-block-ops.ts"
import { ensureCvSection } from "./cv-slash.ts"

const ENTRY = new Set(["paperExperience", "paperEducation"])

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

type PmTr = {
  selection: { from: number }
  doc: Parameters<typeof TextSelection.create>[0]
  setSelection: (selection: ReturnType<typeof TextSelection.create>) => void
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
  focus: () => void
  unnestBlock: () => void
  moveBlocksUp: (id?: string) => void
  moveBlocksDown: (id?: string) => void
  transact: (fn: (tr: unknown) => void) => void
}

function loose(source: object) {
  return source as unknown as LooseEditor
}

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

function textLength(content: unknown) {
  return runsOf(content).reduce((sum, run) => sum + runLength(run), 0)
}

function parentEntry(editor: LooseEditor, block: LooseBlock) {
  const parent = editor.getParentBlock(block)
  if (!parent || !ENTRY.has(parent.type)) return null
  return parent
}

function listKids(block: LooseBlock) {
  return block.children.filter((item) => LIST_TYPES.has(item.type))
}

function deepestList(block: LooseBlock): LooseBlock {
  const kids = listKids(block)
  const last = kids[kids.length - 1]
  if (!last) return block
  return deepestList(last)
}

function copyBlock(block: LooseBlock, keepId = false): Record<string, unknown> {
  const copy: Record<string, unknown> = {
    type: block.type,
    props: block.props,
  }
  if (keepId) copy.id = block.id
  if (block.content !== undefined) copy.content = block.content
  if (block.children.length > 0) {
    copy.children = block.children.map((child) => copyBlock(child, keepId))
  }
  return copy
}

function placeAt(editor: LooseEditor, id: string, offset: number) {
  editor.setTextCursorPosition(id, "start")
  if (offset <= 0) return
  editor.transact((tr) => {
    const live = tr as PmTr
    live.setSelection(
      TextSelection.create(live.doc, live.selection.from + offset)
    )
  })
}

function focusEntryField(blockId: string) {
  const fields = document.querySelectorAll<HTMLElement>(
    `[data-cv-block-fields="${CSS.escape(blockId)}"] [data-cv-field]`
  )
  const last = fields[fields.length - 1]
  if (!last) return false
  last.focus()
  return true
}

function focusBlock(editor: LooseEditor, id: string) {
  const field = document.querySelector<HTMLElement>(
    `[data-cv-block-fields="${CSS.escape(id)}"] [data-cv-field]`
  )
  if (field) {
    field.focus()
    return
  }
  editor.setTextCursorPosition(id, "start")
  editor.focus()
}

function joinEntryBullet(editor: LooseEditor) {
  const { selection } = editor.prosemirrorState
  if (!selection.empty || selection.$from.parentOffset !== 0) return false
  const block = editor.getTextCursorPosition().block
  if (!LIST_TYPES.has(block.type)) return false
  const parent = parentEntry(editor, block)
  if (!parent) return false
  const siblings = listKids(parent)
  const index = siblings.findIndex((item) => item.id === block.id)
  if (index < 0) return false
  if (index === 0) {
    if (!filled(block.content) && block.children.length > 0) {
      let created: LooseBlock[] = []
      editor.transact(() => {
        created = editor.insertBlocks(
          block.children.map((child) => copyBlock(child, true)),
          block.id,
          "before"
        )
        editor.removeBlocks([block])
      })
      const first = created[0]
      if (first) editor.setTextCursorPosition(first.id, "start")
      return true
    }
    if (!filled(block.content)) {
      editor.removeBlocks([block])
      return true
    }
    focusEntryField(parent.id)
    return true
  }
  const prev = siblings[index - 1]!
  const target = deepestList(prev)
  const offset = textLength(target.content)
  const content = [...runsOf(target.content), ...runsOf(block.content)]
  editor.transact(() => {
    editor.updateBlock(target.id, { content })
    if (block.children.length > 0) {
      editor.insertBlocks(
        block.children.map((child) => copyBlock(child, true)),
        target.id,
        "last-child"
      )
    }
    editor.removeBlocks([block])
  })
  placeAt(editor, target.id, offset)
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
    else focusEntryField(parent.id)
    return true
  }
  const prev = parent.children[index - 1]!
  if (prev.type !== "paperSkillItem") return false
  const offset = textLength(prev.content)
  const content = [...runsOf(prev.content), ...runsOf(block.content)]
  editor.transact(() => {
    editor.updateBlock(prev.id, { content })
    editor.removeBlocks([block])
  })
  placeAt(editor, prev.id, offset)
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
  if (!next) return false
  editor.setTextCursorPosition(next.id, "start")
  editor.focus()
  return true
}

function leaveAfter(editor: LooseEditor, block: LooseBlock) {
  const parent = editor.getParentBlock(block)
  const top = parent ?? block
  const index = editor.document.findIndex((item) => item.id === top.id)
  const next = editor.document[index + 1]
  if (!next) return false
  focusBlock(editor, next.id)
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

export function duplicateCvBlock(source: object, blockId?: string) {
  const editor = loose(source)
  let block: LooseBlock | undefined
  if (blockId) block = editor.getBlock(blockId)
  else {
    try {
      block = editor.getTextCursorPosition().block
    } catch {
      return
    }
  }
  if (!block || block.type === "paperHeader") return
  if (block.type === "paperSection") {
    const doc = editor.document
    const start = doc.findIndex((item) => item.id === block.id)
    if (start < 0) return
    const group = sectionGroup(doc, start)
    const copies = group.map((item) => copyBlock(item))
    const anchor = group[group.length - 1]
    if (!anchor) return
    editor.insertBlocks(copies, anchor.id, "after")
    return
  }
  editor.insertBlocks([copyBlock(block)], block.id, "after")
}

function sectionGroup(doc: LooseBlock[], start: number) {
  let end = start + 1
  while (
    end < doc.length &&
    doc[end]?.type !== "paperSection" &&
    doc[end]?.type !== "paperHeader"
  ) {
    end += 1
  }
  return doc.slice(start, end)
}

export function moveCvBlock(
  source: object,
  blockId: string,
  dir: "up" | "down"
) {
  const editor = loose(source)
  const block = editor.getBlock(blockId)
  if (!block || block.type === "paperHeader") return
  if (block.type !== "paperSection") {
    editor.setTextCursorPosition(block.id, "start")
    if (dir === "up") editor.moveBlocksUp(block.id)
    else editor.moveBlocksDown(block.id)
    return
  }
  const doc = editor.document
  const start = doc.findIndex((item) => item.id === block.id)
  if (start < 0) return
  const group = sectionGroup(doc, start)
  const copies = group.map((item) => copyBlock(item, true))
  if (dir === "up") {
    let prev = start - 1
    while (prev > 0 && doc[prev]?.type !== "paperSection") prev -= 1
    const anchor = doc[prev]
    if (!anchor || anchor.type !== "paperSection") return
    editor.transact(() => {
      editor.removeBlocks(group)
      editor.insertBlocks(copies, anchor.id, "before")
    })
    return
  }
  const nextStart = start + group.length
  if (nextStart >= doc.length) return
  const rest = sectionGroup(doc, nextStart)
  const anchor = rest[rest.length - 1]
  if (!anchor) return
  editor.transact(() => {
    editor.removeBlocks(group)
    editor.insertBlocks(copies, anchor.id, "after")
  })
}

const FIELD_NODES = new Set([
  "paperHeader",
  "paperExperience",
  "paperEducation",
  "paperSkills",
])

const INLINE_TURN = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "paperSection",
  "paperSkillItem",
])

const HOLDS_CHILDREN = new Set([
  "paperExperience",
  "paperEducation",
  "bulletListItem",
  "numberedListItem",
])

const FIRST_FIELD: Record<string, string> = {
  paperExperience: "role",
  paperEducation: "school",
  paperSkills: "label",
}

const SECTION_OF: Record<string, string> = {
  paperExperience: "experience",
  paperEducation: "education",
  paperSkills: "skills",
}

function inlineText(content: unknown): string {
  return runsOf(content)
    .map((run) =>
      run.type === "link" && run.content
        ? inlineText(run.content)
        : (run.text ?? "")
    )
    .join("")
}

function propsText(props: Record<string, unknown>) {
  const names = [
    "role",
    "company",
    "school",
    "degree",
    "label",
    "period",
    "location",
    "detail",
  ]
  return names
    .map((name) => (typeof props[name] === "string" ? props[name] : ""))
    .filter((part) => part.trim() !== "")
    .join(" ")
}

export function blockPlainText(block: {
  content: unknown
  props: Record<string, unknown>
}) {
  const inline = inlineText(block.content).trim()
  return inline || propsText(block.props)
}

export function cvFormatHidden(inField: boolean, nodeName: string | null) {
  return inField || (nodeName !== null && FIELD_NODES.has(nodeName))
}

export function turnCvBlock(
  source: object,
  blockId: string,
  target: { type: string; props?: Record<string, unknown> }
) {
  const editor = loose(source)
  const block = editor.getBlock(blockId)
  if (!block || block.type === "paperHeader" || block.type === "divider") {
    return false
  }
  if (block.children.length > 0 && !HOLDS_CHILDREN.has(target.type))
    return false
  const text = blockPlainText(block)
  const props: Record<string, unknown> = { ...(target.props ?? {}) }
  const field = FIRST_FIELD[target.type]
  if (field) props[field] = text
  const update: Record<string, unknown> = { type: target.type, props }
  if (INLINE_TURN.has(target.type)) update.content = text
  const section = SECTION_OF[target.type]
  const kids = block.children.map((child) => copyBlock(child, true))
  try {
    editor.transact(() => {
      editor.updateBlock(block.id, update)
      const live = editor.getBlock(block.id)
      if (
        live &&
        kids.length > 0 &&
        live.children.length === 0 &&
        HOLDS_CHILDREN.has(target.type)
      ) {
        editor.insertBlocks(kids, live.id, "last-child")
      }
      if (section) ensureCvSection(editor, section, block.id)
    })
  } catch {
    return false
  }
  return true
}

export function addedBlockType(
  blockType: string,
  parentType: string | undefined
) {
  if (blockType === "paperSkillItem" || parentType === "paperSkills") {
    return "paperSkillItem"
  }
  if (
    (LIST_TYPES.has(blockType) || blockType === "paperSkillItem") &&
    (parentType === "paperExperience" ||
      parentType === "paperEducation" ||
      parentType === "bulletListItem" ||
      parentType === "numberedListItem")
  ) {
    return blockType === "numberedListItem"
      ? "numberedListItem"
      : "bulletListItem"
  }
  return "paragraph"
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
  if (event.key === "/" && block.type === "paperSection") {
    event.preventDefault()
    event.stopPropagation()
    return true
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
    if (!filled(block.content)) return leaveAfter(editor, block)
    return splitSkill(editor)
  }
  if (!emptyEntryEnter(editor)) return false
  event.preventDefault()
  event.stopPropagation()
  return true
}
