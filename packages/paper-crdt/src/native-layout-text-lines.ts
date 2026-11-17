import type { Node as DocumentNode } from "@tiptap/pm/model"
import type { EditorView } from "@tiptap/pm/view"
import type { FlowDocument } from "@workspace/domain/internal/paper-presentation"
import { canonicalProps } from "./native-formatting-props.js"
import { effectiveParagraph } from "./native-formatting-render-values.js"
import type { LayoutUnit } from "./measured-page-breaks.js"

export type TextLineCache = Map<
  string,
  { text: string; starts: number[]; widths: number[]; font: string }
>

export function measuredTextLines(
  view: EditorView,
  block: { node: DocumentNode; pos: number; dom: HTMLElement },
  scale: number,
  input: FlowDocument,
  cache: TextLineCache
): LayoutUnit[] {
  const units: LayoutUnit[] = []
  const origin = view.dom.getBoundingClientRect().top
  const walker = document.createTreeWalker(block.dom, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('style, [contenteditable="false"]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  })
  const range = document.createRange()
  let run = 0
  while (walker.nextNode()) {
    const text = walker.currentNode
    if (!(text instanceof Text) || !text.length) continue
    const key = `${block.node.attrs.id}:${run++}`
    const style = getComputedStyle(text.parentElement!)
    const entry = cache.get(key)
    const cached = entry?.font === style.font ? entry : undefined
    let prefix = 0
    if (cached)
      while (
        prefix < Math.min(text.length, cached.text.length) &&
        text.data[prefix] === cached.text[prefix]
      )
        prefix++
    const starts: number[] = []
    const lineHeight = parseFloat(style.lineHeight)
    range.selectNodeContents(text)
    const rects = Array.from(range.getClientRects())
    let start = 0
    for (const [line, rect] of rects.entries()) {
      if (line > 0) {
        const saved = cached?.starts[line]
        if (
          saved !== undefined &&
          prefix >= saved &&
          Math.abs(
            (cached?.widths[line - 1] ?? -1) - rects[line - 1]!.width / scale
          ) < 0.1
        )
          start = saved
        else {
          let low = start + 1
          let high = text.length
          while (low < high) {
            const middle = Math.floor((low + high) / 2)
            range.setStart(text, middle)
            range.setEnd(text, middle + 1)
            if (range.getBoundingClientRect().bottom < rect.top + 0.5 * scale)
              low = middle + 1
            else high = middle
          }
          start = low
        }
      }
      if (start >= text.length) continue
      starts.push(start)
      const leading = Number.isFinite(lineHeight)
        ? Math.max(0, lineHeight - rect.height / scale) / 2
        : 0
      const top = (rect.top - origin) / scale - leading
      const bottom = (rect.bottom - origin) / scale + leading
      const previous = units[units.length - 1]
      if (
        previous &&
        Math.min(previous.bottom, bottom) - Math.max(previous.top, top) > 0.5
      ) {
        previous.bottom = Math.max(previous.bottom, bottom)
        previous.top = Math.min(previous.top, top)
      } else
        units.push({
          pos: view.posAtDOM(text, start),
          end: block.pos + block.node.nodeSize,
          top,
          bottom,
          kind: "line",
          keepWithNext: false,
          paragraph: null,
        })
    }
    cache.set(key, {
      text: text.data,
      starts,
      widths: rects.map((rect) => rect.width / scale),
      font: style.font,
    })
  }
  const properties = effectiveParagraph(
    input.presentation,
    canonicalProps(block.node.firstChild?.attrs ?? {})
  )
  return units.map((unit, line) => ({
    ...unit,
    keepWithNext: Boolean(properties.keepNext),
    paragraph: {
      id: block.pos,
      line,
      count: units.length,
      keepTogether: Boolean(properties.keepTogether),
      widowOrphan: properties.widowOrphan !== false,
    },
  }))
}
