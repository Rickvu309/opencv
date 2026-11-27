import {
  Fragment,
  Slice,
  type Mark as PmMark,
  type Node,
} from "prosemirror-model"
import type { Transaction } from "prosemirror-state"
import type { BlockId, Pos, Range, Refusal } from "@workspace/domain/paper-doc"

import { containerAt, posIndex, toPm } from "./positions.js"
import { paperSchema } from "./schema.js"

export type CommandContext = {
  tr: Transaction
  newId: () => BlockId
  caret: number | null
}

export const schemaRefusal = (detail: string): Refusal => ({
  code: "schema",
  detail,
})

type Resolved = { from: number; to: number; at: Pos } | { refusal: Refusal }

export function resolveRange(doc: Node, range: Range): Resolved {
  const a = toPm(doc, range.from)
  if (a === null)
    return { refusal: { code: "no-such-position", at: range.from } }
  const b = toPm(doc, range.to)
  if (b === null) return { refusal: { code: "no-such-position", at: range.to } }
  const [from, to] = a <= b ? [a, b] : [b, a]
  const at = a <= b ? range.from : range.to
  const start = containerAt(doc, from)
  const end = containerAt(doc, to)
  if (start !== end && (start?.cell || end?.cell)) {
    return { refusal: schemaRefusal("A range cannot cross a table cell") }
  }
  return { from, to, at }
}

export function inlineNodes(text: string, marks: readonly PmMark[]): Node[] {
  const nodes: Node[] = []
  text.split("\n").forEach((part, index) => {
    if (index > 0) nodes.push(paperSchema.nodes.hard_break!.create())
    if (part) nodes.push(paperSchema.text(part, marks))
  })
  return nodes
}

export function replaceText(
  ctx: CommandContext,
  from: number,
  to: number,
  nodes: Node[]
) {
  const fragment = Fragment.from(nodes)
  ctx.tr.replace(from, to, new Slice(fragment, 0, 0))
  ctx.caret = from + fragment.size
}

export function deleteBlock(
  ctx: CommandContext,
  block: BlockId
): Refusal | null {
  const { tr } = ctx
  const entry = posIndex(tr.doc).blocks.get(block)
  if (!entry) return { code: "no-such-position", at: { block, offset: 0 } }
  const end = entry.pos + entry.node.nodeSize
  if (tr.doc.childCount === 1) {
    tr.replaceWith(
      entry.pos,
      end,
      paperSchema.nodes.text_block!.create({ id: ctx.newId() })
    )
  } else {
    tr.delete(entry.pos, end)
  }
  ctx.caret = entry.pos
  return null
}
