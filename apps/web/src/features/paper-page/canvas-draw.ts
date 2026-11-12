import type { WordMark } from "@workspace/domain"

import type { TextPoint, WritingBlock } from "./canvas-edit.ts"
import {
  carryLook,
  drawnSegments,
  listMarkers,
  type DrawnSegment,
  type LookBook,
  type LookEntry,
} from "./canvas-look.ts"

const MARK_TAGS: Record<WordMark, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  link: "span",
}

const BLANK = "\u200b"

const LIST_STEP_EM = 1.5

type ParagraphDrawing = {
  text: string
  entry: LookEntry | undefined
  marker: string | null
}

function setAttribute(node: HTMLElement, name: string, value: string | null) {
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name)
    return
  }
  if (node.getAttribute(name) !== value) node.setAttribute(name, value)
}

function headingLevel(entry: LookEntry | undefined): string | null {
  const form = entry?.look.form
  if (form?.kind === "title") return "1"
  if (form?.kind === "heading") return String(Math.min(6, form.level + 1))
  return null
}

function listLevel(entry: LookEntry | undefined): string | null {
  const form = entry?.look.form
  return form?.kind === "bullet" || form?.kind === "number"
    ? String(form.level)
    : null
}

function shapeOf(node: HTMLElement) {
  return [...node.childNodes]
    .map((child) =>
      child.nodeType === Node.TEXT_NODE
        ? `|${child.nodeValue ?? ""}`
        : `${(child as Element).getAttribute("data-marks") ?? "?"}|${child.textContent ?? ""}`
    )
    .join("\u0001")
}

function wantedShape(segments: readonly DrawnSegment[]) {
  return segments
    .map((segment) => `${segment.marks.join(" ")}|${segment.text}`)
    .join("\u0001")
}

function segmentNode(document: Document, segment: DrawnSegment): Node {
  const text = document.createTextNode(segment.text)
  const elements = segment.marks.map((mark) => {
    const element = document.createElement(MARK_TAGS[mark])
    if (mark === "link") element.className = "writing-link"
    return element
  })
  const outer = elements[0]
  if (!outer) return text
  elements.reduce((parent, child) => parent.appendChild(child))
  const innermost = elements.at(-1) ?? outer
  innermost.appendChild(text)
  outer.setAttribute("data-marks", segment.marks.join(" "))
  return outer
}

function drawParagraph(node: HTMLElement, drawing: ParagraphDrawing) {
  const { entry, text } = drawing
  const heading = headingLevel(entry)
  const level = listLevel(entry)
  setAttribute(node, "data-form", entry?.look.form?.kind ?? null)
  setAttribute(node, "role", heading === null ? null : "heading")
  setAttribute(node, "aria-level", heading)
  setAttribute(node, "data-align", entry?.look.align ?? null)
  setAttribute(node, "data-marker", level === null ? null : drawing.marker)
  setAttribute(node, "data-level", level)
  const indent = level === null ? "" : `${(Number(level) + 1) * LIST_STEP_EM}em`
  if (node.style.paddingInlineStart !== indent)
    node.style.paddingInlineStart = indent
  const segments =
    text === BLANK ? [{ text, marks: [] }] : drawnSegments(entry, text, null)
  if (shapeOf(node) === wantedShape(segments)) return
  node.replaceChildren(
    ...segments.map((segment) => segmentNode(node.ownerDocument, segment))
  )
}

function textNodes(block: HTMLElement): Text[] {
  const walker = block.ownerDocument.createTreeWalker(
    block,
    NodeFilter.SHOW_TEXT
  )
  const nodes: Text[] = []
  for (let next = walker.nextNode(); next; next = walker.nextNode())
    nodes.push(next as Text)
  return nodes
}

export function textOffsetIn(block: HTMLElement, node: Node, offset: number) {
  let before = 0
  for (const text of textNodes(block)) {
    if (text === node) return before + offset
    before += text.data.length
  }
  return offset
}

function textNodeAt(
  block: HTMLElement,
  offset: number
): { node: Text; offset: number } | null {
  const nodes = textNodes(block)
  let left = Math.max(0, offset)
  for (const node of nodes) {
    if (node.data === BLANK) return { node, offset: 0 }
    if (left <= node.data.length) return { node, offset: left }
    left -= node.data.length
  }
  const last = nodes.at(-1)
  return last ? { node: last, offset: last.data.length } : null
}

export function visibleText(text: string) {
  return text.length === 0 ? "\u200b" : text
}

function blockSelector(id: string) {
  return `p[data-block="${id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`
}

export type DrawnLooks = Map<string, { source: LookEntry; current: LookEntry }>

export function syncParagraphs(
  root: HTMLElement,
  blocks: WritingBlock[],
  looks: LookBook,
  caret: TextPoint,
  drawn: DrawnLooks
) {
  const nodes = [...root.querySelectorAll<HTMLElement>(":scope > p")]
  const markers = listMarkers(blocks, (id) => looks.get(id)?.look.form)
  const present = new Set(blocks.map((block) => block.id))
  for (const id of drawn.keys()) if (!present.has(id)) drawn.delete(id)
  blocks.forEach((block, index) => {
    let node = nodes[index]
    if (!node) {
      node = root.ownerDocument.createElement("p")
      root.appendChild(node)
    }
    node.dataset.block = block.id
    node.contentEditable = block.held ? "false" : "true"
    const source = looks.get(block.id)
    const kept = drawn.get(block.id)
    const base = kept && kept.source === source ? kept.current : source
    const current = base
      ? carryLook(
          base,
          block.text,
          caret.blockId === block.id ? caret.offset : null
        )
      : undefined
    if (source && current) drawn.set(block.id, { source, current })
    else drawn.delete(block.id)
    drawParagraph(node, {
      text: visibleText(block.text),
      entry: current,
      marker: markers.get(block.id) ?? null,
    })
  })
  nodes.slice(blocks.length).forEach((node) => node.remove())
}

export function placeCaret(root: HTMLElement, caret: TextPoint) {
  const block = root.querySelector<HTMLElement>(blockSelector(caret.blockId))
  if (!block) return
  const found = textNodeAt(block, caret.offset)
  if (!found) return
  const range = root.ownerDocument.createRange()
  range.setStart(found.node, found.offset)
  range.collapse(true)
  const selection = root.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}
