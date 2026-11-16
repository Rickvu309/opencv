import { paperTableLimits } from "@workspace/domain"
import { TextSelection } from "@tiptap/pm/state"
import { yUndoPluginKey } from "y-prosemirror"
import {
  photoLayoutCellSchema,
  photoLayoutRowSchema,
  photoLayoutTableSchema,
  type LayoutTable,
} from "@workspace/domain/internal/paper-presentation"
import {
  commitFlowTableEdits,
  readFlow,
  type FlowBinding,
} from "./native-layout-flow.js"
import type { PrivateLayoutEditor } from "./native-layout-schema.js"
import { layoutCellAt } from "./native-layout-transaction.js"

const id = () => crypto.randomUUID()
const cell = (columnId: string) =>
  photoLayoutCellSchema.parse({
    id: id(),
    type: "cell" as const,
    columnId,
    children: [
      { id: id(), type: "paragraph" as const, paragraph: {}, content: [] },
    ],
  })
const row = (table: Pick<LayoutTable, "columns">) =>
  photoLayoutRowSchema.parse({
    id: id(),
    type: "row" as const,
    children: table.columns.map((column) => cell(column.id)),
  })

export function flowTableControls(
  binding: FlowBinding,
  editor: PrivateLayoutEditor
) {
  const history = yUndoPluginKey.getState(editor.prosemirrorState)?.undoManager
  if (!history) throw new Error("Tables need document history")
  history.addTrackedOrigin("private-flow-table")
  const change = (edits: readonly unknown[]) => {
    if (!editor.isEditable) throw new Error("Paper is not ready for editing")
    history.stopCapturing()
    const result = commitFlowTableEdits(binding, edits)
    history.stopCapturing()
    if (result.kind === "refused") throw new Error(result.reason)
  }
  const activeTable = () => {
    const cellId = layoutCellAt(editor.prosemirrorState.selection.$from)
    for (const section of readFlow(binding).flow.children) {
      for (const table of section.children) {
        if (table.type !== "table") continue
        for (const [rowIndex, row] of table.children.entries()) {
          const columnIndex = row.children.findIndex(
            (cell) => cell.id === cellId
          )
          if (columnIndex >= 0) return { table, rowIndex, columnIndex, section }
        }
      }
    }
    return null
  }
  const selected = () => {
    const selected = activeTable()
    if (!selected) throw new Error("Choose a table cell")
    return selected
  }
  const focusCell = (
    table: LayoutTable,
    rowIndex: number,
    columnIndex: number
  ) => {
    const target = table.children[
      Math.min(rowIndex, table.children.length - 1)
    ]?.children[Math.min(columnIndex, table.columns.length - 1)]?.children.find(
      (node) => node.type !== "photo"
    )
    if (target) editor.setTextCursorPosition(target.id, "start")
    editor.focus()
  }
  const addTableRow = (after = true, firstCell = false) => {
    const { table, rowIndex, columnIndex } = selected()
    const added = row(table)
    change([
      {
        kind: "insert-row",
        tableId: table.id,
        afterId: table.children[rowIndex - (after ? 0 : 1)]?.id ?? null,
        row: added,
      },
    ])
    editor.setTextCursorPosition(
      added.children[firstCell ? 0 : columnIndex]?.children[0]?.id ?? added.id,
      "start"
    )
    editor.focus()
  }
  return {
    activeTable,
    insertTable(rows: number, columns: number) {
      if (
        !Number.isInteger(rows) ||
        rows < 1 ||
        rows > paperTableLimits.rows ||
        !Number.isInteger(columns) ||
        columns < 1 ||
        columns > paperTableLimits.columns
      )
        throw new Error("Choose 1–100 rows and 1–20 columns")
      const document = readFlow(binding)
      const selection = editor.prosemirrorState.selection.$from
      const ancestors = new Set([editor.getTextCursorPosition().block.id])
      for (let depth = 0; depth <= selection.depth; depth++) {
        const node = selection.node(depth)
        if (typeof node.attrs.id === "string") ancestors.add(node.attrs.id)
      }
      const section = document.flow.children.find((section) =>
        section.children.some((node) => ancestors.has(node.id))
      )
      if (!section || activeTable())
        throw new Error("Place the cursor outside a table")
      const anchor = section.children.find((node) => ancestors.has(node.id))
      if (!anchor) throw new Error("Place the cursor in the document")
      const available = Math.floor(
        (section.page.width -
          section.page.start -
          section.page.end -
          (section.columns.count - 1) * section.columns.gap) /
          section.columns.count
      )
      if (available < columns * 480)
        throw new Error("Choose fewer columns to fit the page")
      const grid = Array.from({ length: columns }, () => ({
        id: id(),
        width: Math.floor(available / columns),
      }))
      const table = photoLayoutTableSchema.parse({
        id: id(),
        type: "table",
        columns: grid,
        children: Array.from({ length: rows }, () =>
          row({ columns: photoLayoutTableSchema.shape.columns.parse(grid) })
        ),
      })
      change([{ kind: "insert-table", afterId: anchor.id, table }])
      focusCell(table, 0, 0)
    },
    addTableRow,
    removeTableRow() {
      const { table, rowIndex, columnIndex } = selected()
      const row = table.children[rowIndex]
      if (!row) return
      change([{ kind: "remove-row", tableId: table.id, rowId: row.id }])
      const next = activeTable()?.table ?? {
        ...table,
        children: table.children.filter((item) => item.id !== row.id),
      }
      focusCell(next, rowIndex, columnIndex)
    },
    addTableColumn(after = true) {
      const { table, rowIndex, columnIndex, section } = selected()
      const available = Math.floor(
        (section.page.width -
          section.page.start -
          section.page.end -
          (section.columns.count - 1) * section.columns.gap) /
          section.columns.count
      )
      const width = Math.floor(available / (table.columns.length + 1))
      if (width < 480) throw new Error("No room for another column")
      const column = { id: id(), width }
      change([
        ...table.columns
          .map((column) => ({
            kind: "resize-column",
            tableId: table.id,
            column: { ...column, width },
          }))
          .sort(
            (a, b) =>
              a.column.width -
              (table.columns.find((column) => column.id === a.column.id)
                ?.width ?? 0) -
              (b.column.width -
                (table.columns.find((column) => column.id === b.column.id)
                  ?.width ?? 0))
          ),
        {
          kind: "insert-column",
          tableId: table.id,
          afterId: table.columns[columnIndex - (after ? 0 : 1)]?.id ?? null,
          column,
          cells: table.children.map((row) => ({
            rowId: row.id,
            cell: cell(column.id),
          })),
        },
      ])
      const next = activeTable()
      if (next) focusCell(next.table, rowIndex, columnIndex + (after ? 1 : 0))
    },
    removeTableColumn() {
      const { table, rowIndex, columnIndex } = selected()
      const column = table.columns[columnIndex]
      if (!column) return
      change([
        { kind: "remove-column", tableId: table.id, columnId: column.id },
      ])
      const next = readFlow(binding)
        .flow.children.flatMap((section) => section.children)
        .find((node) => node.id === table.id)
      if (next?.type === "table") focusCell(next, rowIndex, columnIndex)
    },
    resizeTableColumn(columnIndex: number, width: number) {
      const { table, section } = selected()
      const column = table.columns[columnIndex]
      if (!column) return
      const neighbor =
        table.columns[columnIndex + 1] ?? table.columns[columnIndex - 1]
      const available = Math.floor(
        (section.page.width -
          section.page.start -
          section.page.end -
          (section.columns.count - 1) * section.columns.gap) /
          section.columns.count
      )
      const maximum = neighbor ? column.width + neighbor.width - 480 : available
      const next = Math.max(480, Math.min(maximum, Math.round(width)))
      if (next === column.width) return
      change([
        ...[
          {
            kind: "resize-column",
            tableId: table.id,
            column: { ...column, width: next },
          },
          ...(neighbor
            ? [
                {
                  kind: "resize-column",
                  tableId: table.id,
                  column: {
                    ...neighbor,
                    width: neighbor.width + column.width - next,
                  },
                },
              ]
            : []),
        ].sort((a, b) => {
          const before = (entry: typeof a) =>
            table.columns.find((column) => column.id === entry.column.id)
              ?.width ?? 0
          return a.column.width - before(a) - (b.column.width - before(b))
        }),
      ])
    },
    removeTable() {
      const { table } = selected()
      change([{ kind: "remove-table", tableId: table.id }])
      const state = editor.prosemirrorState
      const next =
        TextSelection.findFrom(state.selection.$from, 1, true) ??
        TextSelection.findFrom(state.selection.$from, -1, true)
      if (next) editor.prosemirrorView.dispatch(state.tr.setSelection(next))
      editor.focus()
    },
  }
}
