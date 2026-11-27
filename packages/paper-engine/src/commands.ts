import { Mark as PmMark, type Node } from "prosemirror-model"
import type { Transaction } from "prosemirror-state"
import type {
  BlockId,
  DocCommand,
  Mark,
  Pos,
  Range,
  Refusal,
} from "@workspace/domain/paper-doc"

import {
  inlineNodes,
  replaceText,
  resolveRange,
  schemaRefusal,
  type CommandContext,
} from "./command-context.js"
import { applyStructureCommand } from "./structure.js"
import { containerAt, posIndex, toPm, type BlockEntry } from "./positions.js"
import { paperSchema } from "./schema.js"

type Outcome = Refusal | null

const rangeText = (doc: Node, from: number, to: number) =>
  doc.textBetween(from, to, "\n", "\n")

function marksAt(tr: Transaction, from: number, to: number) {
  if (tr.storedMarks && from === to && from === tr.selection.head)
    return tr.storedMarks
  const $from = tr.doc.resolve(from)
  if (from === to) return $from.marks()
  return $from.marksAcross(tr.doc.resolve(to)) ?? $from.marks()
}

function marksOfDeletedText(tr: Transaction, from: number, to: number) {
  if (from === to) return null
  let first: readonly PmMark[] | null = null
  tr.doc.nodesBetween(from, to, (node) => {
    if (first) return false
    if (node.isText) first = node.marks
    return !first
  })
  return first
}

function keptAfterDelete(
  tr: Transaction,
  at: number,
  deleted: readonly PmMark[] | null
) {
  if (!deleted) return null
  const link = paperSchema.marks.link!
  const caretMarks = tr.doc.resolve(at).marks()
  let kept: readonly PmMark[] = caretMarks.filter((mark) => mark.type === link)
  for (const mark of deleted) if (mark.type !== link) kept = mark.addToSet(kept)
  return PmMark.sameSet(kept, caretMarks) ? null : kept
}

function pmMark(mark: Mark): PmMark {
  return paperSchema.mark(mark.type, "attrs" in mark ? mark.attrs : null)
}

function textBlockEntries(
  doc: Node,
  blocks: readonly BlockId[]
): BlockEntry[] | Refusal {
  const index = posIndex(doc)
  const entries: BlockEntry[] = []
  for (const block of blocks) {
    const entry = index.blocks.get(block)
    if (!entry) return { code: "no-such-position", at: { block, offset: 0 } }
    if (entry.node.type.name !== "text_block") {
      return schemaRefusal(`${block} is not a text block`)
    }
    entries.push(entry)
  }
  return entries
}

function setBlockAttrs(
  ctx: CommandContext,
  blocks: readonly BlockId[],
  attrsFor: (node: Node) => Record<string, unknown>
): Outcome {
  const entries = textBlockEntries(ctx.tr.doc, blocks)
  if (!Array.isArray(entries)) return entries
  for (const entry of entries) {
    for (const [name, value] of Object.entries(attrsFor(entry.node))) {
      if (entry.node.attrs[name] !== value) {
        ctx.tr.setNodeAttribute(entry.pos, name, value)
      }
    }
  }
  return null
}

function splitBlock(ctx: CommandContext, at: Pos): Outcome {
  const { tr } = ctx
  const pm = toPm(tr.doc, at)
  const container = pm === null ? null : containerAt(tr.doc, pm)
  if (pm === null || !container) return { code: "no-such-position", at }
  if (container.cell) {
    replaceText(ctx, pm, pm, [paperSchema.nodes.hard_break!.create()])
    return null
  }
  const entry = posIndex(tr.doc).blocks.get(container.block)!
  const node = entry.node
  if (node.attrs.list !== null && node.content.size === 0) {
    tr.setNodeAttribute(entry.pos, "list", null)
    if (node.attrs.level !== 0) tr.setNodeAttribute(entry.pos, "level", 0)
    ctx.caret = pm
    return null
  }
  const attrs = { ...node.attrs, id: ctx.newId() }
  if (at.offset === 0 && node.content.size > 0) {
    tr.insert(entry.pos, node.type.create(attrs))
    ctx.caret = entry.pos + 3
    return null
  }
  tr.split(pm, 1, [{ type: node.type, attrs }])
  ctx.caret = pm + 2
  return null
}

function joinBlocks(
  ctx: CommandContext,
  block: BlockId,
  direction: "backward" | "forward"
): Outcome {
  const { tr } = ctx
  const entries = textBlockEntries(tr.doc, [block])
  if (!Array.isArray(entries)) return entries
  const entry = entries[0]!
  const neighbourIndex = entry.index + (direction === "backward" ? -1 : 1)
  if (neighbourIndex < 0 || neighbourIndex >= tr.doc.childCount) {
    return { code: "no-such-position", at: { block, offset: 0 } }
  }
  const neighbour = tr.doc.child(neighbourIndex)
  const boundary =
    direction === "backward" ? entry.pos : entry.pos + entry.node.nodeSize
  if (neighbour.type.name === "text_block") {
    ctx.caret =
      direction === "backward"
        ? boundary - 1
        : entry.pos + 1 + entry.node.content.size
    tr.join(boundary)
    return null
  }
  if (!neighbour.isAtom) {
    return schemaRefusal(`${block} cannot join a ${neighbour.type.name}`)
  }
  if (direction === "backward") {
    tr.delete(boundary - neighbour.nodeSize, boundary)
    ctx.caret = boundary - neighbour.nodeSize + 1
  } else {
    tr.delete(boundary, boundary + neighbour.nodeSize)
    ctx.caret = boundary - 1
  }
  return null
}

function withExpect(
  ctx: CommandContext,
  range: Range,
  expect: string | undefined,
  then: (from: number, to: number) => void
): Outcome {
  const resolved = resolveRange(ctx.tr.doc, range)
  if ("refusal" in resolved) return resolved.refusal
  const found = rangeText(ctx.tr.doc, resolved.from, resolved.to)
  if (expect !== undefined && found !== expect) {
    return { code: "expect-mismatch", at: resolved.at, found }
  }
  then(resolved.from, resolved.to)
  return null
}

function addTextMark(tr: Transaction, from: number, to: number, mark: PmMark) {
  const spans: [number, number][] = []
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return true
    if (mark.isInSet(node.marks)) return false
    const start = Math.max(from, pos)
    const end = Math.min(to, pos + node.nodeSize)
    const last = spans.at(-1)
    if (last && last[1] === start) last[1] = end
    else spans.push([start, end])
    return false
  })
  for (const [start, end] of spans) {
    tr.removeMark(start, end, mark.type)
    tr.addMark(start, end, mark)
  }
}

const FORMAT_MARKS = Object.values(paperSchema.marks).filter(
  (type) => type.name !== "link"
)

export function applyCommand(
  ctx: CommandContext,
  command: DocCommand
): Outcome {
  const { tr } = ctx
  switch (command.op) {
    case "insertText":
      return withExpect(ctx, command.range, command.expect, (from, to) => {
        const marks = marksAt(tr, from, to)
        replaceText(ctx, from, to, inlineNodes(command.text, marks))
      })
    case "deleteRange":
      return withExpect(ctx, command.range, command.expect, (from, to) => {
        const deleted = marksOfDeletedText(tr, from, to)
        tr.delete(from, to)
        ctx.caret = from
        ctx.keptMarks = keptAfterDelete(tr, from, deleted)
      })
    case "splitBlock":
      return splitBlock(ctx, command.at)
    case "joinBlocks":
      return joinBlocks(ctx, command.block, command.direction)
    case "setBlockKind":
      return setBlockAttrs(ctx, command.blocks, () => ({ kind: command.kind }))
    case "setList":
      return setBlockAttrs(ctx, command.blocks, (node) => ({
        list: command.list,
        level: command.list === null ? 0 : node.attrs.level,
      }))
    case "shiftLevel":
      return setBlockAttrs(ctx, command.blocks, (node) =>
        node.attrs.list === null
          ? {}
          : {
              level: Math.min(8, Math.max(0, node.attrs.level + command.by)),
            }
      )
    case "setAlign":
      return setBlockAttrs(ctx, command.blocks, () => ({
        align: command.align,
      }))
    case "setMark":
      return withExpect(ctx, command.range, undefined, (from, to) => {
        const mark = pmMark(command.mark)
        if (from === to) {
          if (command.on) tr.addStoredMark(mark)
          else tr.removeStoredMark(mark.type)
        } else if (command.on) addTextMark(tr, from, to, mark)
        else tr.removeMark(from, to, mark.type)
      })
    case "clearFormatting":
      return withExpect(ctx, command.range, undefined, (from, to) => {
        for (const type of FORMAT_MARKS) tr.removeMark(from, to, type)
      })
    case "setLink":
      return withExpect(ctx, command.range, undefined, (from, to) => {
        const linkType = paperSchema.marks.link!
        if (command.href === null) {
          tr.removeMark(from, to, linkType)
          return
        }
        const link = linkType.create({ href: command.href })
        if (command.text === undefined && from !== to) {
          addTextMark(tr, from, to, link)
          return
        }
        const marks = link.addToSet(marksAt(tr, from, to))
        replaceText(
          ctx,
          from,
          to,
          inlineNodes(command.text ?? command.href, marks)
        )
      })
    case "setLineSpacing":
    case "setRightTab":
      return schemaRefusal(`${command.op} is not supported yet`)
    default:
      return applyStructureCommand(ctx, command)
  }
}
