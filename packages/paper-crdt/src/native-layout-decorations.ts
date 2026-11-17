import type { Node } from "@tiptap/pm/model"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import {
  layoutTableSchema,
  tableBordersSchema,
  resolveTableBorders,
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
    if (node.attrs.borders) {
      const borders = resolveTableBorders(
        tableBordersSchema.parse(JSON.parse(node.attrs.borders))
      )
      let rows = 0
      node.descendants((child) => {
        if (child.type.name === "paperRow") rows++
      })
      let index = 0
      node.descendants((child, offset) => {
        if (child.type.name !== "paperCell") return
        const row = Math.floor(index / columns.length)
        const column = index++ % columns.length
        const stroke = `${borders.size / 6}px solid ${borders.color}`
        const edge = (visible: boolean) =>
          borders.mode !== "none" && visible ? stroke : "0px solid transparent"
        decorations.push(
          Decoration.node(pos + 1 + offset, pos + 1 + offset + child.nodeSize, {
            style: `border-block-start:${edge(borders.mode === "all" || row === 0)};border-inline-end:${edge(borders.mode === "all" || column === columns.length - 1)};border-block-end:${edge(row === rows - 1)};border-inline-start:${edge(column === 0)}`,
          })
        )
      })
    }
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
