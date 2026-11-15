import { z } from "zod"
import { nodeIdSchema } from "./nodes.js"
import {
  layoutTableSchema,
  layoutRowSchema,
  layoutColumnSchema,
  layoutCellSchema,
  privateLayoutSchema,
  type PrivateLayoutDocument,
  type LayoutTable,
} from "./native-layout.js"
import { canonical, ok, refuse, type Result } from "./presentation-values.js"

export const layoutEditSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("insert-table"),
      afterId: nodeIdSchema.nullable(),
      table: layoutTableSchema,
    })
    .strict(),
  z.object({ kind: z.literal("remove-table"), tableId: nodeIdSchema }).strict(),
  z
    .object({
      kind: z.literal("insert-row"),
      tableId: nodeIdSchema,
      afterId: nodeIdSchema.nullable(),
      row: layoutRowSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("remove-row"),
      tableId: nodeIdSchema,
      rowId: nodeIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("insert-column"),
      tableId: nodeIdSchema,
      afterId: nodeIdSchema.nullable(),
      column: layoutColumnSchema,
      cells: z
        .array(
          z.object({ rowId: nodeIdSchema, cell: layoutCellSchema }).strict()
        )
        .min(1)
        .max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("remove-column"),
      tableId: nodeIdSchema,
      columnId: nodeIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("resize-column"),
      tableId: nodeIdSchema,
      column: layoutColumnSchema,
    })
    .strict(),
])
export type LayoutEdit = z.infer<typeof layoutEditSchema>
export const layoutReceiptSchema = z
  .object({
    version: z.literal(1),
    profile: z.literal("private-layout-1"),
    kind: z.enum(["cv", "letter"]),
    flowId: nodeIdSchema,
    tableId: nodeIdSchema,
    before: layoutTableSchema.nullable(),
    after: layoutTableSchema.nullable(),
    previousId: nodeIdSchema.nullable(),
    nextId: nodeIdSchema.nullable(),
  })
  .strict()
  .refine(
    (r) =>
      (r.before !== null || r.after !== null) &&
      (!r.before || r.before.id === r.tableId) &&
      (!r.after || r.after.id === r.tableId),
    "Receipt identities disagree"
  )
export type LayoutReceipt = z.infer<typeof layoutReceiptSchema>

function indexAfter(nodes: readonly { id: string }[], id: string | null) {
  if (id === null) return 0
  const index = nodes.findIndex((node) => node.id === id)
  if (index < 0) throw new Error("Missing insertion neighbor")
  return index + 1
}
function editTable(
  table: LayoutTable,
  change: Exclude<LayoutEdit, { kind: "insert-table" | "remove-table" }>
): LayoutTable {
  switch (change.kind) {
    case "insert-row":
      table.children.splice(
        indexAfter(table.children, change.afterId),
        0,
        change.row
      )
      break
    case "remove-row": {
      const index = table.children.findIndex((row) => row.id === change.rowId)
      if (index < 0 || table.children.length === 1)
        throw new Error("Cannot remove the final or missing row")
      table.children.splice(index, 1)
      break
    }
    case "insert-column": {
      const index = indexAfter(table.columns, change.afterId)
      if (
        change.cells.length !== table.children.length ||
        new Set(change.cells.map((entry) => entry.rowId)).size !==
          change.cells.length
      )
        throw new Error("Every row needs one new cell")
      table.columns.splice(index, 0, change.column)
      for (const row of table.children) {
        const entry = change.cells.find((cell) => cell.rowId === row.id)
        if (!entry || entry.cell.columnId !== change.column.id)
          throw new Error("Missing or misplaced new cell")
        row.children.splice(index, 0, entry.cell)
      }
      break
    }
    case "remove-column": {
      const index = table.columns.findIndex(
        (column) => column.id === change.columnId
      )
      if (index < 0 || table.columns.length === 1)
        throw new Error("Cannot remove the final or missing column")
      table.columns.splice(index, 1)
      table.children.forEach((row) => row.children.splice(index, 1))
      break
    }
    case "resize-column": {
      const column = table.columns.find(
        (column) => column.id === change.column.id
      )
      if (!column) throw new Error("Missing column")
      column.width = change.column.width
      break
    }
    default: {
      const exhaustive: never = change
      return exhaustive
    }
  }
  return layoutTableSchema.parse(table)
}
export function prepareLayoutEdit(
  input: unknown,
  edit: unknown
): Result<{
  document: PrivateLayoutDocument
  receipt: LayoutReceipt
  basis: string
}> {
  try {
    const current = privateLayoutSchema.parse(input)
    const basis = canonical(current)
    const doc = privateLayoutSchema.parse(current)
    const change = layoutEditSchema.parse(edit)
    const index =
      change.kind === "insert-table"
        ? indexAfter(doc.flow.children, change.afterId)
        : doc.flow.children.findIndex(
            (node) => node.id === change.tableId && node.type === "table"
          )
    if (index < 0) throw new Error("Missing table")
    const existing = doc.flow.children[index]
    const before =
      change.kind === "insert-table"
        ? null
        : existing?.type === "table"
          ? layoutTableSchema.parse(existing)
          : null
    const tableId =
      change.kind === "insert-table" ? change.table.id : change.tableId
    const previousId = doc.flow.children[index - 1]?.id ?? null
    const nextId = doc.flow.children[index + (before ? 1 : 0)]?.id ?? null
    let after: LayoutTable | null
    if (change.kind === "insert-table") {
      after = change.table
      doc.flow.children.splice(index, 0, after)
    } else if (change.kind === "remove-table") {
      after = null
      doc.flow.children.splice(index, 1)
    } else {
      if (!before) throw new Error("Missing table")
      after = editTable(layoutTableSchema.parse(before), change)
      doc.flow.children.splice(index, 1, after)
    }
    return ok({
      document: privateLayoutSchema.parse(doc),
      receipt: layoutReceiptSchema.parse({
        version: 1,
        profile: doc.profile,
        kind: doc.kind,
        flowId: doc.flow.id,
        tableId,
        before,
        after,
        previousId,
        nextId,
      }),
      basis,
    })
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Invalid layout edit"
    )
  }
}

const recordSchema = z.record(z.string(), z.unknown())
function restore(before: unknown, after: unknown, current: unknown): unknown {
  if (canonical(before) === canonical(after)) return current
  if (canonical(after) === canonical(current)) return before
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(current)) {
    const identified = z.array(z.object({ id: nodeIdSchema }).passthrough())
    const b = identified.parse(before),
      a = identified.parse(after),
      c = identified.parse(current)
    const order = (nodes: typeof b) => nodes.map((node) => node.id)
    if (canonical(order(b)) !== canonical(order(a))) {
      if (canonical(order(c)) !== canonical(order(a)))
        throw new Error("Layout order changed after this action")
      return b
        .map((node) => {
          const next = a.find((item) => item.id === node.id)
          const live = c.find((item) => item.id === node.id)
          return next ? restore(node, next, live) : node
        })
        .concat(
          c
            .filter((node) => !b.some((item) => item.id === node.id))
            .flatMap((node) => {
              const expected = a.find((item) => item.id === node.id)
              if (canonical(node) !== canonical(expected))
                throw new Error("Inserted content has later edits")
              return []
            })
        )
    }
    for (const node of b) {
      const next = a.find((item) => item.id === node.id)
      if (
        next &&
        canonical(node) !== canonical(next) &&
        !c.some((item) => item.id === node.id)
      )
        throw new Error("The affected identity was removed later")
    }
    return c.map((node) => {
      const old = b.find((item) => item.id === node.id),
        next = a.find((item) => item.id === node.id)
      return old && next ? restore(old, next, node) : node
    })
  }
  if (
    before !== null &&
    after !== null &&
    current !== null &&
    typeof before === "object" &&
    typeof after === "object" &&
    typeof current === "object"
  ) {
    const b = recordSchema.parse(before),
      a = recordSchema.parse(after),
      c = recordSchema.parse(current)
    const result = { ...c }
    for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (canonical(b[key]) === canonical(a[key])) continue
      const value = restore(b[key], a[key], c[key])
      if (value === undefined) delete result[key]
      else result[key] = value
    }
    return result
  }
  throw new Error("The affected value changed after this action")
}
export function reverseLayoutEdit(
  input: unknown,
  inverse: unknown
): Result<PrivateLayoutDocument> {
  try {
    const doc = privateLayoutSchema.parse(input),
      receipt = layoutReceiptSchema.parse(inverse)
    if (doc.kind !== receipt.kind || doc.flow.id !== receipt.flowId)
      throw new Error("Foreign layout receipt")
    const index = doc.flow.children.findIndex(
      (node) => node.id === receipt.tableId
    )
    const current = index < 0 ? null : doc.flow.children[index]
    if (receipt.before && receipt.after) {
      if (!current || current.type !== "table")
        throw new Error("The table no longer exists")
      doc.flow.children.splice(
        index,
        1,
        layoutTableSchema.parse(restore(receipt.before, receipt.after, current))
      )
    } else if (receipt.after) {
      if (canonical(current) !== canonical(receipt.after))
        throw new Error("Inserted table has later edits")
      doc.flow.children.splice(index, 1)
    } else if (receipt.before) {
      if (current) throw new Error("Removed identity is already in use")
      const insert = indexAfter(doc.flow.children, receipt.previousId)
      if ((doc.flow.children[insert]?.id ?? null) !== receipt.nextId)
        throw new Error("Table neighbors changed")
      doc.flow.children.splice(insert, 0, receipt.before)
    }
    return ok(privateLayoutSchema.parse(doc))
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Invalid layout reversal"
    )
  }
}
