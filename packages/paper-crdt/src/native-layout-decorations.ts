import type { Node } from "@tiptap/pm/model"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import {
  layoutTableSchema,
  type DocumentPresentation,
} from "@workspace/domain/internal/paper-presentation"
import { formattingDecorations } from "./native-formatting-decorations.js"

export function layoutDecorations(
  doc: Node,
  presentation: DocumentPresentation
) {
  const decorations = formattingDecorations(doc, presentation).find()
  doc.descendants((node, pos) => {
    if (node.type.name !== "paperTable") return
    const columns = layoutTableSchema.shape.columns.parse(
      JSON.parse(node.attrs.columns)
    )
    const total = columns.reduce((sum, column) => sum + column.width, 0)
    const grid = columns
      .map((column) => `minmax(0,${column.width}fr)`)
      .join(" ")
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        style: `--paper-table-columns:${grid};--paper-table-width:${total / 20}pt`,
      })
    )
  })
  return DecorationSet.create(doc, decorations)
}
