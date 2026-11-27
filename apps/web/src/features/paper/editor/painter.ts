import type { Document } from "@workspace/domain/paper-doc"
import type {
  Box,
  FaceKey,
  Layout,
  LineBox,
  Page,
  Segment,
} from "@workspace/paper-engine"

export const MPT_PER_PX = 750
export const PAGE_GAP_PX = 24

export const px = (mpt: number) => mpt / MPT_PER_PX

export type FaceHeights = {
  face(key: FaceKey): { ascent: number; descent: number }
}

export type Placement = { widthPx: number; heightPx: number; pitchPx: number }

export function placement(layout: Layout): Placement {
  const first = layout.pages[0]!
  const widthPx = px(first.size.w)
  const heightPx = px(first.size.h)
  return { widthPx, heightPx, pitchPx: heightPx + PAGE_GAP_PX }
}

export function pageScale(availablePx: number, widthPx: number): number {
  return Math.min(1, Math.max(0.1, availablePx / widthPx))
}

type BlockFacts = { kind: string; list: string; level: number }

function factsOf(doc: Document | undefined): Map<string, BlockFacts> {
  const facts = new Map<string, BlockFacts>()
  for (const block of doc?.content ?? []) {
    facts.set(
      block.attrs.id,
      block.type === "text_block"
        ? {
            kind: block.attrs.kind,
            list: block.attrs.list ?? "",
            level: block.attrs.level,
          }
        : { kind: block.type, list: "", level: 0 }
    )
  }
  return facts
}

type Painted = {
  el: HTMLElement
  box: Box
  facts: BlockFacts | undefined
  content: string
  place: string
}
type PageSlot = {
  el: HTMLElement
  page: Page | null
  lines: Map<string, Painted>
}

function faceStyle(face: string) {
  const variant = /-(bold-italic|bold|italic|regular)$/.exec(face)?.[1]
  const family = variant ? face.slice(0, -variant.length - 1) : face
  return {
    family: `"paper-${family}"`,
    weight: variant?.startsWith("bold") ? "700" : "400",
    style: variant?.endsWith("italic") ? "italic" : "normal",
  }
}

function glyphSpan(
  metrics: FaceHeights,
  line: LineBox,
  run: Pick<Segment, "x" | "text" | "font" | "sizeMpt">,
  extra: Partial<Segment>
): HTMLElement {
  const span = document.createElement("span")
  span.className = "paper-run"
  span.textContent = run.text.replaceAll("\t", "")
  const face = metrics.face(run.font)
  const sizePx = px(run.sizeMpt)
  const ascent = face.ascent / 1000
  const height = (face.ascent + Math.abs(face.descent)) / 1000
  const { family, weight, style } = faceStyle(run.font)
  span.style.left = `${px(run.x - line.rect.x)}px`
  span.style.top = `${px(line.baseline - line.rect.y) - ascent * sizePx}px`
  span.style.fontFamily = family
  span.style.fontWeight = weight
  span.style.fontStyle = style
  span.style.fontSize = `${sizePx}px`
  span.style.lineHeight = `${height}`
  if (extra.color && !extra.href) span.style.color = extra.color
  const lines = [
    extra.underline || extra.href ? "underline" : "",
    extra.strike ? "line-through" : "",
  ].filter(Boolean)
  if (lines.length) span.style.textDecorationLine = lines.join(" ")
  return span
}

function keepPlainRun(
  el: HTMLElement,
  before: LineBox | undefined,
  after: LineBox
): boolean {
  if (
    !before ||
    before.marker ||
    after.marker ||
    before.segments.length !== 1 ||
    after.segments.length !== 1
  )
    return false

  const previous = before.segments[0]!
  const next = after.segments[0]!
  const text = el.firstChild?.firstChild
  if (
    !(text instanceof Text) ||
    previous.x - before.rect.x !== next.x - after.rect.x ||
    before.baseline - before.rect.y !== after.baseline - after.rect.y ||
    previous.font !== next.font ||
    previous.sizeMpt !== next.sizeMpt ||
    previous.color !== next.color ||
    previous.underline !== next.underline ||
    previous.strike !== next.strike ||
    previous.href !== next.href
  )
    return false
  const value = next.text.replaceAll("\t", "")
  if (text.data !== value) text.data = value
  return true
}

function fillLine(
  el: HTMLElement,
  metrics: FaceHeights,
  box: LineBox,
  facts: BlockFacts | undefined,
  before: LineBox | undefined
) {
  const kind = facts?.kind ?? ""
  const list = facts?.list ?? ""
  const level = String(facts?.level ?? 0)
  const from = String(box.from)
  if (el.dataset.kind !== kind) el.dataset.kind = kind
  if (el.dataset.list !== list) el.dataset.list = list
  if (el.dataset.level !== level) el.dataset.level = level
  if (el.dataset.from !== from) el.dataset.from = from
  if (keepPlainRun(el, before, box)) return
  const children: HTMLElement[] = []
  if (box.marker) {
    const marker = glyphSpan(metrics, box, box.marker, {})
    marker.dataset.marker = ""
    children.push(marker)
  }
  for (const segment of box.segments) {
    const span = glyphSpan(metrics, box, segment, segment)
    if (segment.href) span.dataset.href = segment.href
    children.push(span)
  }
  el.replaceChildren(...children)
}

function placeBox(el: HTMLElement, box: Box) {
  el.style.left = `${px(box.rect.x)}px`
  el.style.top = `${px(box.rect.y)}px`
  el.style.width = `${px(box.rect.w)}px`
  el.style.height = `${px(box.rect.h)}px`
}

const CLASS_OF: Record<Box["kind"], string> = {
  line: "paper-line",
  image: "paper-image",
  rule: "paper-rule",
  break: "paper-break",
  cell: "paper-cell",
}

function keyOf(box: Box, counters: Map<string, number>): string {
  const cell =
    box.kind === "line" && box.cell
      ? `${box.cell.row}.${box.cell.col}`
      : box.kind === "cell"
        ? `${box.row}.${box.col}`
        : ""
  const base = `${box.kind}:${box.block}:${cell}`
  const n = counters.get(base) ?? 0
  counters.set(base, n + 1)
  return `${base}:${n}`
}

function contentOf(box: Box, facts: BlockFacts | undefined): string {
  if (box.kind === "line")
    return JSON.stringify([
      box.from,
      box.rect.x,
      box.segments,
      box.marker,
      box.baseline - box.rect.y,
      facts,
    ])
  if (box.kind === "cell") return box.borders
  if (box.kind === "image") return box.fileId
  return ""
}

function sameLine(
  old: Painted,
  box: Box,
  facts: BlockFacts | undefined
): boolean {
  const before = old.box
  return (
    before.kind === "line" &&
    box.kind === "line" &&
    before.segments === box.segments &&
    before.marker === box.marker &&
    before.from === box.from &&
    before.rect.x === box.rect.x &&
    before.baseline - before.rect.y === box.baseline - box.rect.y &&
    old.facts?.kind === facts?.kind &&
    old.facts?.list === facts?.list &&
    old.facts?.level === facts?.level
  )
}

export type Painter = {
  paint(layout: Layout, doc?: Document): void
  touched(): number
}

export function createPainter(
  stage: HTMLElement,
  metrics: FaceHeights
): Painter {
  const pages: PageSlot[] = []
  let touched = 0
  let size: Page["size"] | undefined
  return {
    touched: () => touched,
    paint(layout, doc) {
      touched = 0
      let facts: Map<string, BlockFacts> | undefined
      const nextSize = layout.pages[0]!.size
      const resized = size?.w !== nextSize.w || size?.h !== nextSize.h
      size = nextSize
      const { heightPx, widthPx, pitchPx } = placement(layout)
      layout.pages.forEach((page, index) => {
        let slot = pages[index]
        if (!slot) {
          const el = document.createElement("div")
          el.className = "paper-editor-page"
          el.dataset.page = String(index)
          stage.insertBefore(el, stage.lastElementChild)
          slot = { el, page: null, lines: new Map() }
          pages[index] = slot
          touched += 1
        }
        if (resized || !slot.page) {
          slot.el.style.top = `${index * pitchPx}px`
          slot.el.style.width = `${widthPx}px`
          slot.el.style.height = `${heightPx}px`
        }
        if (slot.page === page) return
        slot.page = page
        facts ??= factsOf(doc)
        const seen = new Set<string>()
        const counters = new Map<string, number>()
        for (const box of page.boxes) {
          const key = keyOf(box, counters)
          seen.add(key)
          const old = slot.lines.get(key)
          if (old && old.box === box) continue
          const blockFacts = facts.get(box.block)
          const content =
            old && sameLine(old, box, blockFacts)
              ? old.content
              : contentOf(box, blockFacts)
          const place = `${box.rect.x},${box.rect.y},${box.rect.w},${box.rect.h}`
          const painted: Painted = old ?? {
            el: document.createElement("div"),
            box,
            facts: blockFacts,
            content: "",
            place: "",
          }
          if (!old) {
            painted.el.className = CLASS_OF[box.kind]
            painted.el.dataset.block = box.block
            if (box.kind === "line" && box.cell)
              painted.el.dataset.cell = `${box.cell.row}.${box.cell.col}`
            slot.el.append(painted.el)
            slot.lines.set(key, painted)
          }
          if (painted.content !== content || !old) {
            if (box.kind === "line")
              fillLine(
                painted.el,
                metrics,
                box,
                blockFacts,
                old?.box.kind === "line" ? old.box : undefined
              )
            if (box.kind === "cell") painted.el.dataset.borders = box.borders
            painted.content = content
            touched += 1
          }
          if (painted.place !== place) {
            placeBox(painted.el, box)
            painted.place = place
            touched += 1
          }
          painted.box = box
          painted.facts = blockFacts
        }
        for (const [key, painted] of slot.lines) {
          if (seen.has(key)) continue
          painted.el.remove()
          slot.lines.delete(key)
          touched += 1
        }
      })
      while (pages.length > layout.pages.length) {
        pages.pop()!.el.remove()
        touched += 1
      }
    },
  }
}
