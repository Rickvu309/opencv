import type { Node } from "@tiptap/pm/model"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import {
  layoutTableSchema,
  layoutPhotoSchema,
  photoBounds,
  type DocumentPresentation,
} from "@workspace/domain/internal/paper-presentation"
import { formattingDecorations } from "./native-formatting-decorations.js"

export function layoutDecorations(
  doc: Node,
  presentation: DocumentPresentation
) {
  const decorations = formattingDecorations(doc, presentation).find()
  doc.descendants((node, pos) => {
    if (
      node.type.name === "blockContainer" &&
      node.firstChild?.type.name === "paperPhoto"
    ) {
      const photo = layoutPhotoSchema.parse(
          JSON.parse(node.firstChild.attrs.photo)
        ),
        bounds = photoBounds(photo)
      const placement =
        photo.placement.kind === "wrap"
          ? `float:${photo.placement.side}`
          : `clear:both;margin-left:${photo.placement.alignment === "left" ? "0" : "auto"};margin-right:${photo.placement.alignment === "right" ? "0" : "auto"}`
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          style: `display:block;max-width:100%;width:${(bounds.width + photo.spacing.left + photo.spacing.right) / 20}pt;${placement}`,
          "data-paper-photo-placement": photo.placement.kind,
        })
      )
    }
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
