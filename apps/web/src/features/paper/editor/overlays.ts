import type { Pos, Range } from "@workspace/domain/paper-doc"
import {
  caret,
  type Layout,
  type LineBox,
  type Metrics,
} from "@workspace/paper-engine"

import { comparePos, ordered, type DocIndex } from "./doc-positions.ts"
import { px } from "./painter.ts"

export type PageRect = {
  page: number
  x: number
  y: number
  w: number
  h: number
}

function lineEnd(box: LineBox): number {
  const last = box.segments.at(-1)
  return last ? last.x + last.w : box.rect.x
}

function lineStart(box: LineBox): number {
  return box.segments[0]?.x ?? box.rect.x
}

function xOn(metrics: Metrics, layout: Layout, box: LineBox, pos: Pos): number {
  if (pos.offset >= box.to) return lineEnd(box)
  if (pos.offset <= box.from) return lineStart(box)
  return caret(metrics, layout, pos).x
}

export function rangeRects(
  metrics: Metrics,
  layout: Layout,
  index: DocIndex,
  range: Range,
  fullLines: boolean
): PageRect[] {
  const { from, to } = ordered(index, range)
  const rects: PageRect[] = []
  for (const page of layout.pages) {
    for (const box of page.boxes) {
      if (box.kind !== "line") {
        if (box.kind === "image" || box.kind === "rule") {
          const at = { block: box.block, offset: 0 }
          if (
            comparePos(index, at, from) >= 0 &&
            comparePos(index, { ...at, offset: 1 }, to) <= 0
          )
            rects.push({ page: page.index, ...box.rect })
        }
        continue
      }
      const start: Pos = { block: box.block, cell: box.cell, offset: box.from }
      const end: Pos = { ...start, offset: box.to }
      if (comparePos(index, end, from) < 0) continue
      if (comparePos(index, start, to) > 0) continue
      if (comparePos(index, start, to) === 0 && box.to > box.from) continue
      const left =
        comparePos(index, from, start) <= 0
          ? lineStart(box)
          : xOn(metrics, layout, box, from)
      const reachesEnd = comparePos(index, to, end) > 0
      const right = reachesEnd
        ? fullLines
          ? Math.max(lineEnd(box) + 4000, left + 4000)
          : lineEnd(box)
        : xOn(metrics, layout, box, to)
      if (right <= left && !reachesEnd) continue
      rects.push({
        page: page.index,
        x: left,
        y: box.rect.y,
        w: Math.max(0, right - left),
        h: box.rect.h,
      })
    }
  }
  return rects
}

export type OverlayFrame = {
  pitchPx: number
  caret: PageRect | null
  selection: PageRect[]
  composition: PageRect[]
  found: PageRect[]
  active: PageRect[]
  focused: boolean
}

export type Overlays = {
  layer: HTMLElement
  draw(frame: OverlayFrame): void
  caretElement(): HTMLElement
}

function placeRect(el: HTMLElement, rect: PageRect, pitchPx: number) {
  el.style.transform = `translate(${px(rect.x)}px, ${rect.page * pitchPx + px(rect.y)}px)`
  el.style.width = `${px(rect.w)}px`
  el.style.height = `${px(rect.h)}px`
}

function syncRects(
  host: HTMLElement,
  className: string,
  rects: PageRect[],
  pitchPx: number
) {
  const kids = [...host.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.classList.contains(className)
  )
  rects.forEach((rect, n) => {
    let el = kids[n]
    if (!el) {
      el = document.createElement("div")
      el.className = className
      el.style.top = "0"
      el.style.left = "0"
      host.prepend(el)
    }
    placeRect(el, rect, pitchPx)
  })
  for (const extra of kids.slice(rects.length)) extra.remove()
}

export function createOverlays(): Overlays {
  const layer = document.createElement("div")
  layer.className = "paper-overlay"
  const caretEl = document.createElement("div")
  caretEl.className = "paper-caret"
  caretEl.style.top = "0"
  caretEl.style.left = "0"
  layer.append(caretEl)
  let lastCaret = ""
  let phase = false
  return {
    layer,
    caretElement: () => caretEl,
    draw(frame) {
      syncRects(layer, "paper-selection", frame.selection, frame.pitchPx)
      syncRects(layer, "paper-composition", frame.composition, frame.pitchPx)
      syncRects(layer, "paper-find-hit", frame.found, frame.pitchPx)
      syncRects(layer, "paper-find-active", frame.active, frame.pitchPx)
      const show = frame.focused && frame.caret !== null
      caretEl.hidden = !show
      if (!frame.caret) return
      const key = JSON.stringify(frame.caret)
      placeRect(caretEl, { ...frame.caret, w: 0 }, frame.pitchPx)
      caretEl.style.width = ""
      if (key !== lastCaret) {
        lastCaret = key
        phase = !phase
        caretEl.dataset.phase = phase ? "a" : "b"
      }
    },
  }
}
