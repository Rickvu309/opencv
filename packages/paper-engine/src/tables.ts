import type { Node } from "prosemirror-model"
import type { BlockId, DocCommand, Refusal } from "@workspace/domain/paper-doc"

import {
  deleteBlock,
  schemaRefusal,
  type CommandContext,
} from "./command-context.js"
import { posIndex } from "./positions.js"
import { paperSchema } from "./schema.js"

const defaultColumnMpt = 72000
const maxTableCells = 10000

export function tableSizeProblem(rows: number, cols: number): Refusal | null {
  return rows * cols > maxTableCells
    ? { code: "too-large", limit: "10000 table cells" }
    : null
}

const emptyCell = () => paperSchema.nodes.table_cell!.create()
const emptyRow = (cols: number) =>
  paperSchema.nodes.table_row!.create(
    null,
    Array.from({ length: cols }, emptyCell)
  )

export function newTable(id: BlockId, rows: number, cols: number): Node {
  return paperSchema.nodes.table!.create(
    { id, columnsMpt: Array.from({ length: cols }, () => defaultColumnMpt) },
    Array.from({ length: rows }, () => emptyRow(cols))
  )
}

function childOffset(node: Node, index: number): number {
  let offset = 0
  for (let child = 0; child < index; child += 1)
    offset += node.child(child).nodeSize
  return offset
}

export function editTable(
  ctx: CommandContext,
  { block, row, col, action }: Extract<DocCommand, { op: "editTable" }>
): Refusal | null {
  const { tr } = ctx
  const entry = posIndex(tr.doc).blocks.get(block)
  if (!entry) return { code: "no-such-position", at: { block, offset: 0 } }
  const table = entry.node
  if (table.type !== paperSchema.nodes.table)
    return schemaRefusal("Expected a table")
  const rows = table.childCount
  const cols = table.child(0).childCount
  if (action === "deleteTable") return deleteBlock(ctx, block)
  if (row >= rows || col >= cols) {
    return {
      code: "no-such-position",
      at: { block, offset: 0, cell: { row, col } },
    }
  }
  if (
    (action === "deleteRow" && rows === 1) ||
    (action === "deleteCol" && cols === 1)
  ) {
    return deleteBlock(ctx, block)
  }
  if (
    action === "rowAbove" ||
    action === "rowBelow" ||
    action === "deleteRow"
  ) {
    const index = row + Number(action === "rowBelow")
    const from = entry.pos + 1 + childOffset(table, index)
    if (action === "deleteRow")
      tr.delete(from, from + table.child(index).nodeSize)
    else {
      const problem = tableSizeProblem(rows + 1, cols)
      if (problem) return problem
      tr.insert(from, emptyRow(cols))
    }
  } else {
    const deleting = action === "deleteCol"
    const problem = deleting ? null : tableSizeProblem(rows, cols + 1)
    if (problem) return problem
    const index = col + Number(action === "colRight")
    const widths: number[] = [...table.attrs.columnsMpt]
    if (deleting) widths.splice(index, 1)
    else widths.splice(index, 0, widths[col]!)
    const edits: Array<{ from: number; size: number }> = []
    table.forEach((node, offset) => {
      edits.push({
        from: entry.pos + 2 + offset + childOffset(node, index),
        size: deleting ? node.child(index).nodeSize : 0,
      })
    })
    for (const { from, size } of edits.reverse()) {
      if (deleting) tr.delete(from, from + size)
      else tr.insert(from, emptyCell())
    }
    tr.setNodeAttribute(entry.pos, "columnsMpt", widths)
  }
  return null
}
