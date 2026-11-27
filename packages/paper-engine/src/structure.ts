import { Fragment, Slice, type Node } from "prosemirror-model"
import { ReplaceStep } from "prosemirror-transform"
import type {
  Block,
  DocCommand,
  Pos,
  Refusal,
  Run,
} from "@workspace/domain/paper-doc"

import {
  deleteBlock,
  inlineNodes,
  replaceText,
  resolveRange,
  schemaRefusal,
  type CommandContext,
} from "./command-context.js"
import { containerAt, posIndex, toPm } from "./positions.js"
import { paperSchema } from "./schema.js"
import { editTable, newTable, tableSizeProblem } from "./tables.js"

type StructureCommand = Extract<
  DocCommand,
  {
    op:
      | "insertImage"
      | "setImage"
      | "insertTable"
      | "editTable"
      | "insertBlock"
      | "deleteBlock"
      | "pasteFragment"
      | "replaceAll"
      | "setPageSetup"
      | "setTemplate"
  }
>

function replaceBlocks(
  ctx: CommandContext,
  from: number,
  to: number,
  blocks: Node[]
) {
  const { tr } = ctx
  const $from = tr.doc.resolve(from)
  const $to = tr.doc.resolve(to)
  const keepLeft = $from.depth === 1 && $from.parentOffset > 0
  const keepRight =
    $to.depth === 1 && $to.parentOffset < $to.parent.content.size
  const start = $from.depth === 0 || keepLeft ? from : $from.before()
  const end = $to.depth === 0 || keepRight ? to : $to.after()
  const nodes = [...blocks]
  if (keepLeft) nodes.unshift($from.parent.copy(Fragment.empty))
  if (keepRight) {
    const right = $to.parent
    const attrs =
      keepLeft && $from.before() === $to.before()
        ? { ...right.attrs, id: ctx.newId() }
        : right.attrs
    nodes.push(right.type.create(attrs))
  }
  const slice = new Slice(
    Fragment.from(nodes),
    Number(keepLeft),
    Number(keepRight)
  )
  tr.step(new ReplaceStep(start, end, slice))
  ctx.caret = start + slice.size
}

function insertBlock(
  ctx: CommandContext,
  at: Pos,
  create: () => Node
): Refusal | null {
  const doc = ctx.tr.doc
  const pm = toPm(doc, at)
  if (pm === null) return { code: "no-such-position", at }
  const entry = posIndex(doc).blocks.get(at.block)!
  const block = create()
  if (at.cell || (entry.node.isTextblock && !entry.node.content.size)) {
    const boundary = at.cell ? entry.pos + entry.node.nodeSize : entry.pos
    ctx.tr.insert(boundary, block)
    ctx.caret = boundary + block.nodeSize
  } else {
    replaceBlocks(ctx, pm, pm, [block])
  }
  return null
}

function isBlockFragment(fragment: Block[] | Run[]): fragment is Block[] {
  const first = fragment[0]
  return first !== undefined && "attrs" in first
}

function paste(
  ctx: CommandContext,
  { range, fragment }: Extract<StructureCommand, { op: "pasteFragment" }>
): Refusal | null {
  if (!fragment.length) return null
  const { tr } = ctx
  const resolved = resolveRange(tr.doc, range)
  if ("refusal" in resolved) return resolved.refusal
  const { from, to } = resolved
  if (isBlockFragment(fragment)) {
    if (containerAt(tr.doc, from)?.cell) {
      return schemaRefusal("Blocks cannot be pasted inside a table cell")
    }
    replaceBlocks(
      ctx,
      from,
      to,
      fragment.map((block) =>
        paperSchema.nodeFromJSON({
          ...block,
          attrs: { ...block.attrs, id: ctx.newId() },
        })
      )
    )
  } else {
    if (!tr.doc.resolve(from).parent.inlineContent) {
      return schemaRefusal("Inline paste requires a text position")
    }
    replaceText(
      ctx,
      from,
      to,
      fragment.map((run) => paperSchema.nodeFromJSON(run))
    )
  }
  return null
}

function replaceAll(
  ctx: CommandContext,
  { find, replace, matchCase }: Extract<StructureCommand, { op: "replaceAll" }>
) {
  const { tr } = ctx
  const doc = tr.doc
  const literal = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(literal, matchCase ? "gu" : "giu")
  const matches = posIndex(doc).containers.flatMap(({ start, size }) =>
    Array.from(
      doc.textBetween(start, start + size, "", "\n").matchAll(pattern),
      (match) => {
        const from = start + match.index
        return { from, to: from + match[0].length }
      }
    )
  )
  for (const { from, to } of matches.reverse()) {
    const $from = doc.resolve(from)
    const marks = $from.nodeAfter?.marks ?? $from.marks()
    tr.replaceWith(from, to, inlineNodes(replace, marks))
  }
}

export function applyStructureCommand(
  ctx: CommandContext,
  command: StructureCommand
): Refusal | null {
  const { tr } = ctx
  switch (command.op) {
    case "insertImage": {
      const { at, fileId, widthMpt, heightMpt } = command
      return insertBlock(ctx, at, () =>
        paperSchema.nodes.image!.create({
          id: ctx.newId(),
          fileId,
          widthMpt,
          heightMpt,
        })
      )
    }
    case "setImage": {
      const { op: _op, block, ...attrs } = command
      const entry = posIndex(tr.doc).blocks.get(block)
      if (!entry) return { code: "no-such-position", at: { block, offset: 0 } }
      if (entry.node.type !== paperSchema.nodes.image)
        return schemaRefusal("Expected an image")
      for (const [name, value] of Object.entries(attrs)) {
        if (value !== undefined && entry.node.attrs[name] !== value) {
          tr.setNodeAttribute(entry.pos, name, value)
        }
      }
      return null
    }
    case "insertTable": {
      const { at, rows, cols } = command
      return (
        tableSizeProblem(rows, cols) ??
        insertBlock(ctx, at, () => newTable(ctx.newId(), rows, cols))
      )
    }
    case "editTable":
      return editTable(ctx, command)
    case "insertBlock":
      return insertBlock(ctx, command.at, () =>
        paperSchema.nodes[command.block]!.create({ id: ctx.newId() })
      )
    case "deleteBlock":
      return deleteBlock(ctx, command.block)
    case "pasteFragment":
      return paste(ctx, command)
    case "replaceAll":
      replaceAll(ctx, command)
      return null
    case "setPageSetup":
      tr.setDocAttribute("page", command.page)
      return null
    case "setTemplate":
      if (tr.doc.attrs.template !== command.template)
        tr.setDocAttribute("template", command.template)
      return null
  }
}
