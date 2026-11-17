import type { Node as DocumentNode } from "@tiptap/pm/model"
import { Decoration, type EditorView } from "@tiptap/pm/view"
import type { FlowDocument } from "@workspace/domain/internal/paper-presentation"
import {
  measuredTextLines,
  type TextLineCache,
} from "./native-layout-text-lines.js"
import { canonicalProps } from "./native-formatting-props.js"
import { effectiveParagraph } from "./native-formatting-render-values.js"
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

function blockUnits(
  view: EditorView,
  block: MeasuredBlock,
  scale: number,
  input: FlowDocument,
  cache: TextLineCache
): LayoutUnit[] {
  const type =
    block.node.type.name === "paperRow"
      ? "paperRow"
      : block.node.firstChild?.type.name
  if (
    ["paragraph", "bulletListItem", "numberedListItem", "cvField"].includes(
      type ?? ""
    )
  ) {
    const lines = measuredTextLines(view, block, scale, input, cache)
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
      paragraph: null,
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
  const lineCache: TextLineCache = new Map()
  const paintedUnits = new Map<string, LayoutUnit[]>()
  let previousDoc: DocumentNode | null = null
  let offsets: PageOffset[] = []
  let settings = ""
  let invalidated = true
  return {
    invalidate() {
      invalidated = true
      lineCache.clear()
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
          node.childCount > 1 ||
          ["paperFlow", "paperFlowSection", "paperTable", "paperCell"].includes(
            type ?? ""
          )
        )
          return
        const dom = view.nodeDOM(pos)
        if (dom instanceof HTMLElement) blocks.push({ node, pos, dom })
        return false
      })
      if (invalidated || settings !== nextSettings) lineCache.clear()
      if (
        !invalidated &&
        settings === nextSettings &&
        previousDoc &&
        blocks.length === previous.length
      ) {
        const changed = blocks.filter(
          (block, index) => !block.node.eq(previous[index]!.node)
        )
        const start = previousDoc.content.findDiffStart(view.state.doc.content)
        const end = previousDoc.content.findDiffEnd(view.state.doc.content)
        const updates = changed.map((block) => ({
          block,
          units: blockUnits(
            view,
            block,
            Number(
              view.dom.style.getPropertyValue("--cv-rich-page-scale") || 1
            ),
            input,
            lineCache
          ),
        }))
        if (
          changed.length > 0 &&
          start !== null &&
          end &&
          !offsets.some((offset) => offset.pos > start && offset.pos < end.a) &&
          updates.every(({ block, units }) => {
            const before = paintedUnits.get(block.node.attrs.id)
            return (
              before &&
              before.length === units.length &&
              units.every((unit, index) => {
                const old = before[index]!
                return (
                  Math.abs(old.top - unit.top) < 0.1 &&
                  Math.abs(old.bottom - unit.bottom) < 0.1 &&
                  (!offsets.some((offset) => offset.pos === old.pos) ||
                    unit.pos ===
                      (old.pos >= end.a ? old.pos + end.b - end.a : old.pos)) &&
                  old.kind === unit.kind &&
                  old.keepWithNext === unit.keepWithNext &&
                  old.paragraph?.keepTogether ===
                    unit.paragraph?.keepTogether &&
                  old.paragraph?.widowOrphan === unit.paragraph?.widowOrphan
                )
              })
            )
          })
        ) {
          const delta = end.b - end.a
          offsets = offsets.map((offset) => ({
            ...offset,
            pos: offset.pos >= end.a ? offset.pos + delta : offset.pos,
            end: offset.end >= end.a ? offset.end + delta : offset.end,
          }))
          for (const [id, units] of paintedUnits)
            paintedUnits.set(
              id,
              units.map((unit) => ({
                ...unit,
                pos: unit.pos >= end.a ? unit.pos + delta : unit.pos,
                end: unit.end >= end.a ? unit.end + delta : unit.end,
              }))
            )
          for (const { block, units } of updates)
            paintedUnits.set(block.node.attrs.id, units)
          previous = blocks
          previousDoc = view.state.doc
          return false
        }
      }
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
        while (from > 0) {
          const before = blocks[from - 1]!.node.firstChild
          if (
            before?.type.name !== "heading" &&
            !effectiveParagraph(
              input.presentation,
              canonicalProps(before?.attrs ?? {})
            ).keepNext
          )
            break
          from--
        }
      }
      const start = blocks[from]?.pos ?? view.state.doc.content.size
      offsets = offsets.filter((offset) => offset.pos < start)
      const page = input.presentation.page
      const capacity = (page.height - page.top - page.bottom) / 15
      const clips = blocks.flatMap((block) => {
        const type = block.node.firstChild?.type.name
        if (
          [
            "paragraph",
            "bulletListItem",
            "numberedListItem",
            "cvField",
            "paperPageBreak",
          ].includes(type ?? "") ||
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
              contenteditable: "false",
              role: "region",
              "aria-label":
                "Content taller than a page. Scroll to read all content.",
              "data-paper-oversized-block": "true",
            },
            { key: `clip:${capacity}` }
          ),
          ...(block.node.firstChild?.isTextblock
            ? [
                Decoration.node(
                  block.pos + 1,
                  block.pos + 1 + block.node.firstChild.nodeSize,
                  { contenteditable: "true" },
                  { key: "clip-content" }
                ),
              ]
            : []),
        ]
      })
      const cleared = paint([...clips, ...offsets.map(offsetDecoration)])
      const scale = Number(
        view.dom.style.getPropertyValue("--cv-rich-page-scale") || 1
      )
      const units = blocks
        .slice(from)
        .flatMap((block) => blockUnits(view, block, scale, input, lineCache))
      offsets.push(
        ...measuredPageBreaks(units, {
          height: page.height / 15,
          top: page.top / 15,
          bottom: page.bottom / 15,
          gap: 24,
        })
      )
      let painted = paint([...clips, ...offsets.map(offsetDecoration)])
      for (let pass = 0; pass < 4; pass++) {
        const corrections = measuredPageBreaks(
          blocks
            .slice(from)
            .flatMap((block) =>
              blockUnits(view, block, scale, input, lineCache)
            ),
          {
            height: page.height / 15,
            top: page.top / 15,
            bottom: page.bottom / 15,
            gap: 24,
          }
        ).filter((offset) => offset.kind !== "break")
        if (!corrections.length) break
        for (const correction of corrections) {
          const existing = offsets.find(
            (offset) => offset.pos === correction.pos
          )
          if (existing) existing.height += correction.height
          else offsets.push(correction)
        }
        painted = paint([...clips, ...offsets.map(offsetDecoration)]) || painted
      }
      const finalUnits = blocks.flatMap((block) =>
        blockUnits(view, block, scale, input, lineCache)
      )
      const settled = !measuredPageBreaks(
        finalUnits.filter((unit) => unit.pos >= start),
        {
          height: page.height / 15,
          top: page.top / 15,
          bottom: page.bottom / 15,
          gap: 24,
        }
      ).some((offset) => offset.kind !== "break")
      paintedUnits.clear()
      for (const block of blocks)
        paintedUnits.set(
          block.node.attrs.id,
          finalUnits.filter(
            (unit) =>
              unit.pos >= block.pos &&
              unit.pos < block.pos + block.node.nodeSize
          )
        )
      previous = blocks
      previousDoc = view.state.doc
      settings = nextSettings
      invalidated = !settled
      return cleared || painted
    },
  }
}
