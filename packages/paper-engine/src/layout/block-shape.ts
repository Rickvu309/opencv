import type { Block, BlockId, Document } from "@workspace/domain/paper-doc"

import { breakRuns, type LineShape } from "./break-lines.js"
import { faceKey } from "./metrics.js"
import {
  DIVIDER,
  IMAGE_SPACE_AFTER_MPT,
  LIST_INDENT_MPT,
  LIST_ITEM_SPACE_AFTER_MPT,
  TABLE_CELL_PADDING,
  TABLE_SPACE,
  TEMPLATE_STYLES,
  type TemplateId,
} from "./styles.js"
import type { FaceKey, Metrics, Mpt, Rect } from "./types.js"

export type ShapeContext = {
  template: TemplateId
  content: Rect
  metrics: Metrics
}

export type TextShape = {
  kind: "text"
  id: BlockId
  lines: readonly LineShape[]
  before: Mpt
  after: Mpt
  keepWithNext: boolean
  list: "bullet" | "numbered" | null
  level: number
  marker: { x: Mpt; font: FaceKey; sizeMpt: Mpt } | null
}

export type CellShape = {
  col: number
  x: Mpt
  w: Mpt
  lines: readonly LineShape[]
  tops: readonly Mpt[]
}

export type RowShape = { h: Mpt; cells: readonly CellShape[] }

export type TableShape = {
  kind: "table"
  id: BlockId
  rows: readonly RowShape[]
  before: Mpt
  after: Mpt
  borders: "none" | "all"
}

type AtomFields = {
  id: BlockId
  h: Mpt
  after: Mpt
  rect: Rect
  fileId: string | null
}

export type AtomShape =
  (AtomFields & { kind: "image" }) | (AtomFields & { kind: "divider" })

export type BreakShape = { kind: "page_break"; id: BlockId }

export type BlockShape = TextShape | TableShape | AtomShape | BreakShape

export function shapeBlock(block: Block, ctx: ShapeContext): BlockShape {
  const { content, metrics } = ctx
  const kinds = TEMPLATE_STYLES[ctx.template]
  if (block.type === "text_block") {
    const { attrs } = block
    const style = kinds[attrs.kind]
    const indent = attrs.list ? LIST_INDENT_MPT * (attrs.level + 1) : 0
    const lines = breakRuns({
      runs: block.content,
      style,
      left: content.x + indent,
      width: Math.max(1000, content.w - indent),
      align: attrs.align,
      lineSpacing: attrs.lineSpacing ?? 1,
      rightTab:
        attrs.rightTabMpt === undefined ? null : attrs.rightTabMpt - indent,
      metrics,
    })
    return {
      kind: "text",
      id: attrs.id,
      lines,
      before: style.spaceBeforeMpt,
      after: attrs.list ? LIST_ITEM_SPACE_AFTER_MPT : style.spaceAfterMpt,
      keepWithNext: attrs.keepWithNext ?? style.keepWithNext,
      list: attrs.list,
      level: attrs.level,
      marker: attrs.list
        ? {
            x: content.x + LIST_INDENT_MPT * attrs.level,
            font: faceKey(style.family, style.bold, style.italic),
            sizeMpt: style.sizeMpt,
          }
        : null,
    }
  }
  if (block.type === "table") {
    const style = kinds.paragraph
    const rows = block.content.map((row) => {
      let x = content.x
      const cells = row.content.map((cell, col) => {
        const w = block.attrs.columnsMpt[col]!
        const cellX = x
        x += w
        const lines = breakRuns({
          runs: cell.content,
          style,
          left: cellX + TABLE_CELL_PADDING.x,
          width: Math.max(1000, w - 2 * TABLE_CELL_PADDING.x),
          align: "left",
          lineSpacing: 1,
          rightTab: null,
          metrics,
        })
        const tops: Mpt[] = []
        let y = TABLE_CELL_PADDING.y
        for (const line of lines) {
          tops.push(y)
          y += line.h
        }
        return { col, x: cellX, w, lines, tops, h: y + TABLE_CELL_PADDING.y }
      })
      const h = Math.max(...cells.map((cell) => cell.h))
      return {
        h,
        cells: cells.map(({ h: _height, ...cell }) => cell),
      }
    })
    return {
      kind: "table",
      id: block.attrs.id,
      rows,
      before: TABLE_SPACE.before,
      after: TABLE_SPACE.after,
      borders: block.attrs.borders,
    }
  }
  if (block.type === "image") {
    const { attrs } = block
    let w = Math.min(attrs.widthMpt, content.w)
    let h = Math.round((attrs.heightMpt * w) / attrs.widthMpt)
    if (h > content.h) {
      w = Math.round((w * content.h) / h)
      h = content.h
    }
    const free = content.w - w
    const x =
      content.x +
      (attrs.align === "right"
        ? free
        : attrs.align === "center"
          ? Math.floor(free / 2)
          : 0)
    return {
      kind: "image",
      id: attrs.id,
      h,
      after: IMAGE_SPACE_AFTER_MPT,
      rect: { x, y: 0, w, h },
      fileId: attrs.fileId,
    }
  }
  if (block.type === "divider") {
    return {
      kind: "divider",
      id: block.attrs.id,
      h: DIVIDER.height,
      after: 0,
      rect: {
        x: content.x,
        y: Math.floor((DIVIDER.height - DIVIDER.rule) / 2),
        w: content.w,
        h: DIVIDER.rule,
      },
      fileId: null,
    }
  }
  return { kind: "page_break", id: block.attrs.id }
}

export function contentRect(
  page: Document["attrs"]["page"],
  size: { w: Mpt; h: Mpt }
): Rect {
  const m = page.marginsMpt
  return {
    x: m.left,
    y: m.top,
    w: Math.max(1000, size.w - m.left - m.right),
    h: Math.max(1000, size.h - m.top - m.bottom),
  }
}
