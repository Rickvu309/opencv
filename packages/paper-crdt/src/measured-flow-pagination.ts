import type { Node as DocumentNode } from "@tiptap/pm/model"
import { Decoration, type EditorView } from "@tiptap/pm/view"
import type { FlowDocument } from "@workspace/domain/internal/paper-presentation"
import {
  measuredPageBreaks,
  type LayoutUnit,
  type PageOffset,
} from "./measured-page-breaks.js"

type MeasuredBlock = {
  node: DocumentNode
  pos: number
  dom: HTMLElement
}

function textLines(
  view: EditorView,
  block: MeasuredBlock,
  scale: number,
  from: number
) {
  const units: LayoutUnit[] = []
  const origin = view.dom.getBoundingClientRect().top
  const walker = document.createTreeWalker(block.dom, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('style, [contenteditable="false"]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  const range = document.createRange()
  while (walker.nextNode()) {
    const text = walker.currentNode
    if (!(text instanceof Text) || !text.length) continue
    const position = view.posAtDOM(text, 0)
    if (position + text.length <= from) continue
    const style = getComputedStyle(text.parentElement!)
    const lineHeight = parseFloat(style.lineHeight)
    for (let start = Math.max(0, from - position); start < text.length;) {
      range.setStart(text, start)
      range.setEnd(text, start + 1)
      const first = range.getBoundingClientRect()
      let low = start + 1
      let high = text.length
      while (low < high) {
        const middle = Math.floor((low + high) / 2)
        range.setStart(text, middle)
        range.setEnd(text, middle + 1)
        if (Math.abs(range.getBoundingClientRect().top - first.top) < 1)
          low = middle + 1
        else high = middle
      }
      const leading = Number.isFinite(lineHeight)
        ? Math.max(0, lineHeight - first.height / scale) / 2
        : 0
      const top = (first.top - origin) / scale - leading
      const bottom = (first.bottom - origin) / scale + leading
      const previous = units[units.length - 1]
      if (previous && Math.abs(previous.top - top) < 1)
        previous.bottom = Math.max(previous.bottom, bottom)
      else
        units.push({
          pos: view.posAtDOM(text, start),
          end: block.pos + block.node.nodeSize,
          top,
          bottom,
          kind: "line",
          keepWithNext: false,
        })
      start = low
    }
  }
  return units
}

function blockUnits(
  view: EditorView,
  block: MeasuredBlock,
  scale: number,
  from: number
) {
  const type =
    block.node.type.name === "paperRow"
      ? "paperRow"
      : block.node.firstChild?.type.name
  if (
    ["paragraph", "bulletListItem", "numberedListItem"].includes(type ?? "")
  ) {
    const lines = textLines(view, block, scale, from)
    if (lines.length) return lines
  }
  const rect = block.dom.getBoundingClientRect()
  const top = (rect.top - view.dom.getBoundingClientRect().top) / scale
  return [
    {
      pos: block.pos,
      end: block.pos + block.node.nodeSize,
      top,
      bottom: top + rect.height / scale,
      kind:
        type === "paperPageBreak"
          ? "break"
          : type === "paperRow"
            ? "row"
            : "block",
      keepWithNext: type === "heading",
    } satisfies LayoutUnit,
  ]
}

function offsetDecoration(offset: PageOffset) {
  if (offset.kind === "line" || offset.kind === "block")
    return Decoration.widget(
      offset.pos,
      () => {
        const spacer = document.createElement("span")
        spacer.dataset.paperPageSpacer = ""
        spacer.contentEditable = "false"
        spacer.setAttribute("aria-hidden", "true")
        spacer.style.cssText = `display:block;height:${offset.height}px;clear:both;pointer-events:none;user-select:none`
        return spacer
      },
      { side: -1, key: `${offset.pos}:${offset.height}` }
    )
  return Decoration.node(
    offset.pos,
    offset.end,
    {
      style:
        offset.kind === "break"
          ? `height:${offset.height}px`
          : `margin-block-start:${offset.height}px`,
      "data-paper-page-offset": String(offset.height),
    },
    { key: `${offset.kind}:${offset.height}` }
  )
}

export function measuredFlowPagination(
  view: EditorView,
  paint: (decorations: Decoration[]) => boolean
) {
  let previous: MeasuredBlock[] = []
  let previousDocument = view.state.doc
  const previousLines = new Map<number, LayoutUnit[]>()
  let offsets: PageOffset[] = []
  let settings = ""
  let invalidated = true
  return {
    invalidate() {
      invalidated = true
    },
    refresh(input: FlowDocument) {
      const nextSettings = JSON.stringify(input.presentation)
      const blocks: MeasuredBlock[] = []
      view.state.doc.descendants((node, pos) => {
        if (node.type.name === "paperRow") {
          const dom = view.nodeDOM(pos)
          if (dom instanceof HTMLElement) blocks.push({ node, pos, dom })
          return false
        }
        if (node.type.name !== "blockContainer") return
        const type = node.firstChild?.type.name
        if (
          ["paperFlow", "paperFlowSection", "paperTable", "paperCell"].includes(
            type ?? ""
          )
        )
          return
        const dom = view.nodeDOM(pos)
        if (dom instanceof HTMLElement) blocks.push({ node, pos, dom })
        return false
      })
      let from = 0
      if (!invalidated && settings === nextSettings) {
        while (
          from < Math.min(blocks.length, previous.length) &&
          blocks[from]!.node.eq(previous[from]!.node) &&
          blocks[from]!.pos === previous[from]!.pos
        )
          from++
        if (from === blocks.length && from === previous.length) return
        from = Math.max(0, from - 1)
      }
      const start = blocks[from]?.pos ?? view.state.doc.content.size
      const changedAt =
        invalidated || settings !== nextSettings
          ? 0
          : (previousDocument.content.findDiffStart(view.state.doc.content) ??
            0)
      offsets = offsets.filter(
        (offset) =>
          offset.pos < start ||
          (offset.kind === "line" && offset.pos < changedAt)
      )
      const page = input.presentation.page
      const capacity = (page.height - page.top - page.bottom) / 15
      const clips = blocks.flatMap((block) => {
        const type = block.node.firstChild?.type.name
        if (
          !["paperPhoto", "heading"].includes(type ?? "") ||
          block.dom.scrollHeight <= capacity
        )
          return []
        return [
          Decoration.node(
            block.pos,
            block.pos + block.node.nodeSize,
            {
              style: `max-height:${capacity}px;overflow:auto;overscroll-behavior:contain`,
              tabindex: "0",
              role: "region",
              "aria-label":
                "Content taller than a page. Scroll to read all content.",
              "data-paper-oversized-block": "true",
            },
            { key: `clip:${capacity}` }
          ),
        ]
      })
      const cleared = paint([...clips, ...offsets.map(offsetDecoration)])
      const scale = Number(
        view.dom.style.getPropertyValue("--cv-rich-page-scale") || 1
      )
      const units = blocks.slice(from).flatMap((block) => {
        const lines = previousLines.get(block.pos) ?? []
        const followingLine = lines.findIndex((line) => line.pos > changedAt)
        const changedLine =
          !cleared &&
          changedAt >= block.pos &&
          changedAt < block.pos + block.node.nodeSize
            ? (followingLine < 0 ? lines.length : followingLine) - 1
            : -1
        const start = lines[Math.max(0, changedLine - 1)]?.pos ?? 0
        const measured = blockUnits(
          view,
          block,
          scale,
          changedLine > 0 ? start : 0
        )
        const prefix =
          changedLine > 0 ? lines.filter((line) => line.pos < start) : []
        const next = [...prefix, ...measured]
        previousLines.set(
          block.pos,
          next.filter((unit) => unit.kind === "line")
        )
        return next
      })
      offsets.push(
        ...measuredPageBreaks(units, {
          height: page.height / 15,
          top: page.top / 15,
          bottom: page.bottom / 15,
          gap: 24,
        })
      )
      const painted = paint([...clips, ...offsets.map(offsetDecoration)])
      const positions = new Set(blocks.map((block) => block.pos))
      for (const position of previousLines.keys())
        if (!positions.has(position)) previousLines.delete(position)
      previous = blocks
      previousDocument = view.state.doc
      settings = nextSettings
      invalidated = false
      return cleared || painted
    },
  }
}
