import type { Pos } from "@workspace/domain/paper-doc"

import type {
  Box,
  Layout,
  LineBox,
  Metrics,
  Mpt,
  Rect,
  Segment,
} from "./types.js"

export type CaretRect = Rect & { page: number }
export type PagePoint = { page: number; x: Mpt; y: Mpt }

type Found = { page: number; box: LineBox; last: boolean; soft: boolean }

function prefixWidth(metrics: Metrics, segment: Segment, units: number): Mpt {
  const face = metrics.face(segment.font)
  let scaled = 0
  for (let i = 0; i < units;) {
    const code = segment.text.codePointAt(i)!
    scaled += face.advance(code) * segment.sizeMpt
    i += code > 0xffff ? 2 : 1
  }
  return Math.round(scaled / 1000)
}

const sameCell = (box: { cell?: { row: number; col: number } }, pos: Pos) =>
  box.cell?.row === pos.cell?.row && box.cell?.col === pos.cell?.col

function linesOf(layout: Layout, pos: Pos): Found[] {
  const found: Found[] = []
  for (const page of layout.pages) {
    for (const box of page.boxes) {
      if (
        box.kind === "line" &&
        box.block === pos.block &&
        sameCell(box, pos)
      ) {
        found.push({ page: page.index, box, last: false, soft: false })
      }
    }
  }
  found.forEach((entry, n) => {
    const next = found[n + 1]
    entry.last = next === undefined
    entry.soft = next !== undefined && next.box.from === entry.box.to
  })
  return found
}

function lineFor(layout: Layout, pos: Pos): Found | null {
  let chosen: Found | null = null
  for (const entry of linesOf(layout, pos)) {
    if (entry.box.from <= pos.offset && pos.offset <= entry.box.to) {
      chosen = entry
      if (pos.offset < entry.box.to) break
    }
  }
  return chosen
}

function visibleEnd(entry: Found): number {
  if (!entry.soft) return entry.box.to
  const last = entry.box.segments.at(-1)
  if (!last) return entry.box.from
  return Math.max(entry.box.from, last.from + last.text.trimEnd().length)
}

function xAt(metrics: Metrics, box: LineBox, offset: number): Mpt {
  const segments = box.segments
  let x = box.rect.x
  for (const segment of segments) {
    const end = segment.from + segment.text.length
    if (offset < segment.from)
      return segments.indexOf(segment) === 0 ? segment.x : x
    if (offset <= end)
      return segment.x + prefixWidth(metrics, segment, offset - segment.from)
    x = segment.x + segment.w
  }
  return x
}

function offsetAt(metrics: Metrics, entry: Found, x: Mpt): number {
  const { box } = entry
  const segments = box.segments
  if (segments.length === 0) return box.from
  if (x <= segments[0]!.x) return segments[0]!.from
  for (let n = 0; n < segments.length; n += 1) {
    const segment = segments[n]!
    if (x < segment.x + segment.w) {
      if (x < segment.x) {
        const previous = segments[n - 1]!
        const gapMiddle = (previous.x + previous.w + segment.x) / 2
        return x < gapMiddle
          ? previous.from + previous.text.length
          : segment.from
      }
      let best = segment.from
      let bestDistance = Math.abs(x - segment.x)
      for (let i = 0; i <= segment.text.length;) {
        const left = segment.x + prefixWidth(metrics, segment, i)
        const distance = Math.abs(x - left)
        if (distance < bestDistance) {
          best = segment.from + i
          bestDistance = distance
        }
        if (i === segment.text.length) break
        i += segment.text.codePointAt(i)! > 0xffff ? 2 : 1
      }
      return Math.min(best, visibleEnd(entry))
    }
  }
  return visibleEnd(entry)
}

const atomBox = (box: Box) =>
  box.kind === "image" || box.kind === "rule" || box.kind === "break"

function verticalDistance(rect: Rect, y: Mpt): number {
  if (y < rect.y) return rect.y - y
  if (y >= rect.y + rect.h) return y - (rect.y + rect.h) + 1
  return 0
}

export function locate(
  metrics: Metrics,
  layout: Layout,
  point: PagePoint
): Pos {
  const page =
    layout.pages[Math.max(0, Math.min(layout.pages.length - 1, point.page))]!
  const cell = page.boxes.find(
    (box) =>
      box.kind === "cell" &&
      point.x >= box.rect.x &&
      point.x < box.rect.x + box.rect.w &&
      point.y >= box.rect.y &&
      point.y < box.rect.y + box.rect.h
  )
  const candidates = page.boxes.filter((box) =>
    cell && cell.kind === "cell"
      ? box.kind === "line" &&
        box.block === cell.block &&
        box.cell?.row === cell.row &&
        box.cell?.col === cell.col
      : box.kind === "line" || atomBox(box)
  )
  let best: Box | null = null
  let bestDistance = Infinity
  for (const box of candidates) {
    const distance = verticalDistance(box.rect, point.y)
    if (distance < bestDistance) {
      best = box
      bestDistance = distance
    }
  }
  if (!best) {
    const firstLine = layout.pages
      .flatMap((each) => each.boxes)
      .find((box) => box.kind === "line" || atomBox(box))
    return { block: firstLine?.block ?? ("" as Pos["block"]), offset: 0 }
  }
  if (best.kind !== "line") {
    const after =
      point.x >= best.rect.x + best.rect.w / 2 && best.kind !== "break"
    return { block: best.block, offset: after ? 1 : 0 }
  }
  const pos: Pos = best.cell
    ? { block: best.block, cell: best.cell, offset: best.from }
    : { block: best.block, offset: best.from }
  const entry = linesOf(layout, pos).find((each) => each.box === best)!
  return { ...pos, offset: offsetAt(metrics, entry, point.x) }
}

export function caret(metrics: Metrics, layout: Layout, pos: Pos): CaretRect {
  const entry = lineFor(layout, pos)
  if (entry) {
    const { box } = entry
    return {
      page: entry.page,
      x: xAt(metrics, box, pos.offset),
      y: box.rect.y,
      w: 0,
      h: box.rect.h,
    }
  }
  for (const page of layout.pages) {
    for (const box of page.boxes) {
      if (box.block === pos.block && atomBox(box)) {
        const h = box.rect.h > 0 ? box.rect.h : 12000
        return {
          page: page.index,
          x: pos.offset > 0 ? box.rect.x + box.rect.w : box.rect.x,
          y: box.rect.y,
          w: 0,
          h,
        }
      }
    }
  }
  const first = layout.pages[0]!
  return { page: 0, x: first.content.x, y: first.content.y, w: 0, h: 12000 }
}

export function lineEdges(layout: Layout, pos: Pos): { start: Pos; end: Pos } {
  const entry = lineFor(layout, pos)
  if (!entry) return { start: pos, end: pos }
  return {
    start: { ...pos, offset: entry.box.from },
    end: { ...pos, offset: visibleEnd(entry) },
  }
}
