import type { Node } from "@tiptap/pm/model"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import {
  flowSectionSchema,
  type FlowDocument,
  type DocumentPresentation,
} from "@workspace/domain/internal/paper-presentation"
import { layoutDecorations } from "./native-layout-decorations.js"

export function flowPaginationSupport(document: FlowDocument) {
  if (
    !globalThis.CSS?.supports("column-height: 100px") ||
    !CSS.supports("column-wrap: wrap")
  )
    return {
      supported: false,
      reason: "This browser cannot wrap columns into pages",
    }
  if (
    document.flow.children
      .slice(1)
      .some((section) => section.start === "continuous")
  )
    return {
      supported: false,
      reason: "Continuous changes between column sections are not qualified",
    }
  if (
    document.flow.children.some((section) =>
      section.children.some(
        (node, index) =>
          node.type === "pageBreak" &&
          (!index || section.children[index - 1]?.type === "pageBreak")
      )
    )
  )
    return {
      supported: false,
      reason: "Leading and consecutive blank pages are not qualified",
    }
  if (
    document.flow.children.some((section) =>
      section.children.some(
        (node) => node.type === "table" || node.type === "photo"
      )
    )
  )
    return {
      supported: false,
      reason: "Pagination around tables and photos is not qualified",
    }
  return { supported: true, reason: null }
}
export function flowDecorations(
  doc: Node,
  presentation: DocumentPresentation,
  paginated: boolean,
  breaks: ReadonlyMap<string, number>
) {
  const decorations = layoutDecorations(doc, presentation).find()
  let previousBottom: number | undefined
  doc.descendants((node, pos) => {
    if (
      node.type.name === "blockContainer" &&
      node.firstChild?.type.name === "paperPageBreak"
    ) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          style: `break-before:${paginated ? "column" : "auto"};height:${breaks.get(node.attrs.id) ?? 0}px;min-height:0;padding:0;margin:0`,
        })
      )
    }
    if (node.type.name !== "paperFlowSection") return
    const { page, columns } = flowSectionSchema
      .omit({ id: true, type: true, children: true })
      .parse(JSON.parse(node.attrs.settings))
    const sectionGap =
      previousBottom === undefined ? 24 : (previousBottom + page.top) / 15 + 24
    previousBottom = page.bottom
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        style: `--paper-flow-width:${(page.width - page.start - page.end) / 15}px;--paper-column-height:${(page.height - page.top - page.bottom) / 15}px;--paper-columns:${columns.count};--paper-column-gap:${columns.gap / 15}px;--paper-row-gap:${(page.top + page.bottom) / 15 + 24}px;margin-top:${paginated ? sectionGap : 24}px;margin-bottom:0`,
        "data-paper-paginated": String(paginated),
      })
    )
  })
  return DecorationSet.create(doc, decorations)
}
export function installFlowView(
  element: HTMLElement,
  read: () => FlowDocument,
  updateBreaks: (breaks: Map<string, number>) => void
) {
  const style = document.createElement("style")
  style.textContent = `[data-paper-page-flow] .bn-block-group{padding:0}[data-paper-page-flow] [data-paper-layout=paperFlowSection]{width:var(--paper-flow-width);max-width:100%;margin-block:24px}[data-paper-page-flow] [data-paper-layout=paperFlowSection]>[data-paper-wrap-slot]{display:block;column-count:var(--paper-columns);column-gap:var(--paper-column-gap);column-fill:auto}[data-paper-page-flow][data-paper-pagination=true] [data-paper-layout=paperFlowSection]>[data-paper-wrap-slot]{column-height:var(--paper-column-height);column-wrap:wrap;row-gap:var(--paper-row-gap)}[data-paper-page-flow] [data-paper-layout=paperFlowSection]>[data-paper-wrap-slot]>[data-node-type=blockOuter],[data-paper-page-flow] [data-paper-layout=paperFlowSection]>[data-paper-wrap-slot]>[data-node-type=blockOuter]>.bn-block{display:block}[data-paper-page-flow] [data-paper-page-break]{height:0;min-height:0}[data-paper-page-flow] [data-content-type=paperPageBreak]{padding:0;margin:0;min-height:0}[data-paper-page-flow] [data-paper-layout=paperTable]{break-inside:avoid}`
  element.before(style)
  element.dataset.paperPageFlow = ""
  let active = true,
    frame = 0
  function refresh() {
    if (!active) return
    const document = read(),
      support = flowPaginationSupport(document)
    element.dataset.paperPagination = String(support.supported)
    const breaks = new Map<string, number>()
    for (const section of document.flow.children) {
      const dom = element.querySelector<HTMLElement>(
        `[data-paper-layout=paperFlowSection][data-paper-id="${CSS.escape(section.id)}"]`
      )
      const slot = dom?.querySelector<HTMLElement>(
        ":scope > [data-paper-wrap-slot]"
      )
      if (!slot) continue
      const height =
        (section.page.height - section.page.top - section.page.bottom) / 15
      const gap = section.columns.gap / 15,
        width = slot.getBoundingClientRect().width
      const columnWidth =
        (width - gap * (section.columns.count - 1)) / section.columns.count
      for (const node of section.children) {
        if (node.type !== "pageBreak") continue
        const block = slot.querySelector<HTMLElement>(
          `:scope > [data-id="${CSS.escape(node.id)}"]`
        )
        if (!block) continue
        breaks.set(node.id, 0)
        if (!support.supported || section.columns.count === 1) continue
        const previous = block.previousElementSibling
        if (!previous) continue
        const walker = window.document.createTreeWalker(
          previous,
          NodeFilter.SHOW_TEXT
        )
        let last: Text | undefined
        while (walker.nextNode()) {
          const text = walker.currentNode
          if (
            text instanceof Text &&
            text.length &&
            text.parentElement?.tagName !== "STYLE"
          )
            last = text
        }
        const range = window.document.createRange()
        if (last) {
          range.setStart(last, last.length - 1)
          range.setEnd(last, last.length)
        } else range.selectNode(previous)
        const rects = range.getClientRects(),
          rect = rects[rects.length - 1]
        if (!rect) continue
        const column = Math.max(
          0,
          Math.min(
            section.columns.count - 1,
            Math.floor(
              (rect.left - slot.getBoundingClientRect().left) /
                (columnWidth + gap)
            )
          )
        )
        if (column === 0) breaks.set(node.id, height)
      }
    }
    updateBreaks(breaks)
  }
  function schedule() {
    if (frame) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = 0
      refresh()
    })
  }
  const resize = new ResizeObserver(schedule)
  resize.observe(element)
  document.fonts.ready.then(schedule)
  schedule()
  return {
    schedule,
    destroy() {
      active = false
      cancelAnimationFrame(frame)
      resize.disconnect()
      style.remove()
      delete element.dataset.paperPageFlow
      delete element.dataset.paperPagination
    },
  }
}
