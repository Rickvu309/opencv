import type { BlockShape, TextShape } from "./block-shape.js"
import type { Box, Mpt, Rect } from "./types.js"

export type Cursor = { block: number; part: number; counters: string }

export type PageFill = { boxes: Box[]; next: Cursor | null }

const BULLETS = ["•", "◦", "▪"]
const KEEP_CHAIN_DEPTH = 4

function letters(n: number): string {
  let value = n
  let out = ""
  while (value > 0) {
    value -= 1
    out = String.fromCharCode(97 + (value % 26)) + out
    value = Math.floor(value / 26)
  }
  return out
}

function roman(n: number): string {
  const table: [number, string][] = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ]
  let value = n
  let out = ""
  for (const [amount, digits] of table) {
    while (value >= amount) {
      out += digits
      value -= amount
    }
  }
  return out
}

export function numberLabel(n: number, level: number): string {
  const style = level % 3
  return `${style === 0 ? String(n) : style === 1 ? letters(n) : roman(n)}.`
}

export function nextCounters(
  counters: readonly number[],
  shape: BlockShape
): { marker: string | null; counters: number[] } {
  if (shape.kind !== "text" || !shape.list)
    return { marker: null, counters: [] }
  const level = shape.level
  const next = counters.slice(0, level + 1)
  while (next.length < level + 1) next.push(0)
  if (shape.list === "bullet")
    return { marker: BULLETS[level % 3]!, counters: next }
  next[level] = next[level]! + 1
  return { marker: numberLabel(next[level]!, level), counters: next }
}

const parseCounters = (text: string) =>
  text === "" ? [] : text.split(",").map(Number)

const textHeight = (shape: TextShape, from: number, to: number) => {
  let h = 0
  for (let k = from; k < to; k += 1) h += shape.lines[k]!.h
  return h
}

export function fillPage(
  count: number,
  shapeAt: (index: number) => BlockShape,
  cursor: Cursor,
  content: Rect
): PageFill {
  const boxes: Box[] = []
  const room = content.h
  let y = 0
  let empty = true
  let counters = parseCounters(cursor.counters)
  let index = cursor.block
  let part = cursor.part

  const minStart = (at: number, depth: number): Mpt => {
    if (at >= count) return 0
    const shape = shapeAt(at)
    if (shape.kind === "page_break") return 0
    if (shape.kind === "image" || shape.kind === "divider") return shape.h
    if (shape.kind === "table") return shape.before + (shape.rows[0]?.h ?? 0)
    const total = shape.lines.length
    if (shape.keepWithNext && depth < KEEP_CHAIN_DEPTH && at + 1 < count) {
      return (
        shape.before +
        textHeight(shape, 0, total) +
        shape.after +
        minStart(at + 1, depth + 1)
      )
    }
    return shape.before + textHeight(shape, 0, total <= 3 ? total : 2)
  }

  while (index < count) {
    const shape = shapeAt(index)
    const before = counters
    const { marker, counters: after } = nextCounters(counters, shape)
    const resume = (at: number): PageFill => ({
      boxes,
      next: { block: index, part: at, counters: before.join(",") },
    })

    if (shape.kind === "page_break") {
      boxes.push({
        kind: "break",
        block: shape.id,
        rect: { x: content.x, y: content.y + y, w: content.w, h: 0 },
      })
      return {
        boxes,
        next: { block: index + 1, part: 0, counters: after.join(",") },
      }
    }

    if (shape.kind === "image" || shape.kind === "divider") {
      if (!empty && y + shape.h > room) return resume(0)
      const rect = {
        x: shape.rect.x,
        y: content.y + y + shape.rect.y,
        w: shape.rect.w,
        h: shape.rect.h,
      }
      boxes.push(
        shape.kind === "image"
          ? { kind: "image", block: shape.id, rect, fileId: shape.fileId ?? "" }
          : { kind: "rule", block: shape.id, rect }
      )
      y += shape.h + shape.after
      empty = false
      counters = after
      index += 1
      part = 0
      continue
    }

    if (shape.kind === "table") {
      const spaceBefore = empty || part > 0 ? 0 : shape.before
      let used = 0
      let placed = 0
      while (
        part + placed < shape.rows.length &&
        y + spaceBefore + used + shape.rows[part + placed]!.h <= room
      ) {
        used += shape.rows[part + placed]!.h
        placed += 1
      }
      if (placed === 0) {
        if (!empty) return resume(part)
        placed = 1
      }
      let rowTop = content.y + y + spaceBefore
      for (let r = part; r < part + placed; r += 1) {
        const row = shape.rows[r]!
        for (const cell of row.cells) {
          boxes.push({
            kind: "cell",
            block: shape.id,
            row: r,
            col: cell.col,
            rect: { x: cell.x, y: rowTop, w: cell.w, h: row.h },
            borders: shape.borders,
          })
          cell.lines.forEach((line, k) => {
            const top = rowTop + cell.tops[k]!
            boxes.push({
              kind: "line",
              block: shape.id,
              cell: { row: r, col: cell.col },
              rect: { x: line.x, y: top, w: line.w, h: line.h },
              baseline: top + line.ascent,
              from: line.from,
              to: line.to,
              marker: null,
              segments: line.segments,
            })
          })
        }
        rowTop += row.h
      }
      if (part + placed < shape.rows.length) return resume(part + placed)
      y = rowTop - content.y + shape.after
      empty = false
      counters = after
      index += 1
      part = 0
      continue
    }

    const total = shape.lines.length
    const remaining = total - part
    const spaceBefore = empty || part > 0 ? 0 : shape.before
    let fit = 0
    let used = 0
    while (
      fit < remaining &&
      y + spaceBefore + used + shape.lines[part + fit]!.h <= room
    ) {
      used += shape.lines[part + fit]!.h
      fit += 1
    }
    let take = fit
    if (fit >= remaining) {
      const pushed =
        shape.keepWithNext &&
        !empty &&
        index + 1 < count &&
        y + spaceBefore + used + shape.after + minStart(index + 1, 0) > room &&
        used + shape.after + minStart(index + 1, 0) <= room
      if (pushed) return resume(part)
    } else {
      if (remaining - take < 2) take = remaining - 2
      if (part === 0 && take < 2) take = 0
      if (take <= 0) {
        if (!empty) return resume(part)
        take = Math.max(1, fit)
      }
    }
    let top = content.y + y + spaceBefore
    for (let k = part; k < part + take; k += 1) {
      const line = shape.lines[k]!
      boxes.push({
        kind: "line",
        block: shape.id,
        rect: { x: line.x, y: top, w: line.w, h: line.h },
        baseline: top + line.ascent,
        from: line.from,
        to: line.to,
        marker:
          k === 0 && marker && shape.marker
            ? { text: marker, ...shape.marker }
            : null,
        segments: line.segments,
      })
      top += line.h
    }
    if (part + take < total) return resume(part + take)
    y = top - content.y + shape.after
    empty = false
    counters = after
    index += 1
    part = 0
  }
  return { boxes, next: null }
}
