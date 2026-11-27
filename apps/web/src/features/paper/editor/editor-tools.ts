import type {
  Block,
  BlockId,
  DocCommand,
  Document,
  Pos,
  Range,
  Selection,
} from "@workspace/domain/paper-doc"
import type { Layout, Metrics } from "@workspace/paper-engine"

import { createPhotoHandles, createTableTools } from "./block-tools.ts"
import { runsAt, samePos, type DocIndex } from "./doc-positions.ts"
import { createFindBar, findRanges } from "./find-bar.ts"
import { createLinkBubble, linkAt } from "./link-bubble.ts"
import { rangeRects, type PageRect } from "./overlays.ts"
import { px } from "./painter.ts"

type Actions = {
  head(): Pos
  blockOf(block: BlockId): Block | undefined
  run(commands: DocCommand[]): boolean
  select(from: Pos, to: Pos): void
  draw(): void
  sync(): void
  focusEditor(): void
  screenPoint(rect: PageRect): { x: number; y: number }
}

export function createEditorTools(
  host: HTMLElement,
  layer: HTMLElement,
  metrics: Metrics,
  { head, blockOf, run, select, draw, sync, focusEditor, screenPoint }: Actions
) {
  let query = ""
  let searchedIndex: DocIndex | null = null
  let searchedQuery = ""
  let matches: Range[] = []
  let drawnSearch: ReturnType<typeof rangeRects> = []
  let searchedLayout: Layout | null = null
  let activeMatch = -1

  const findBar = createFindBar(host, {
    changed(next) {
      query = next
      activeMatch = -1
      draw()
    },
    visit(n) {
      activeMatch = n
      draw()
      layer
        .querySelector(".paper-find-active")
        ?.scrollIntoView({ block: "nearest" })
    },
    replaceAll(find, replace) {
      run([{ op: "replaceAll", find, replace, matchCase: false }])
      sync()
    },
    focusEditor,
  })
  const linkBubble = createLinkBubble(host, {
    set(range, href, text) {
      const applied = run([
        { op: "setLink", range, href, ...(text === undefined ? {} : { text }) },
      ])
      if (applied && href && text === undefined) select(range.to, range.to)
      return applied
    },
    focusEditor,
  })
  const photoHandles = createPhotoHandles(
    host,
    (block, widthMpt, heightMpt) => {
      run([{ op: "setImage", block, widthMpt, heightMpt }])
    },
    focusEditor
  )
  const tableTools = createTableTools(
    host,
    (action) => {
      const here = head()
      if (!here.cell) return
      if (!run([{ op: "editTable", block: here.block, ...here.cell, action }]))
        return
      const table = blockOf(here.block)
      if (table?.type === "table") {
        const row = Math.min(here.cell.row, table.content.length - 1)
        const col = Math.min(here.cell.col, table.attrs.columnsMpt.length - 1)
        const pos = { block: here.block, cell: { row, col }, offset: 0 }
        select(pos, pos)
      }
      focusEditor()
    },
    focusEditor
  )

  function highlights(layout: Layout, index: DocIndex) {
    if (
      searchedQuery !== query ||
      searchedIndex !== index ||
      searchedLayout !== layout
    ) {
      searchedQuery = query
      searchedIndex = index
      searchedLayout = layout
      matches = findRanges(index, query)
      drawnSearch = matches.flatMap((range) =>
        rangeRects(metrics, layout, index, range, false)
      )
      activeMatch = -1
      findBar.update(matches.length)
    }
    return {
      found: drawnSearch,
      active: matches[activeMatch]
        ? rangeRects(metrics, layout, index, matches[activeMatch]!, false)
        : [],
    }
  }

  function update(
    doc: Document,
    selection: Selection,
    layout: Layout,
    here: Pos,
    headRect: PageRect,
    collapsed: boolean,
    scale: number
  ) {
    const target = screenPoint({ ...headRect, y: headRect.y + headRect.h })
    linkBubble.update(
      query || !collapsed ? null : linkAt(runsAt(doc, here), here),
      target.x,
      target.y
    )
    tableTools.update(here.cell ? target : null)
    const block =
      selection.kind === "block" ? blockOf(selection.block) : undefined
    const page =
      block?.type === "image"
        ? layout.pages.find(({ boxes }) =>
            boxes.some(
              (box) => box.kind === "image" && box.block === block.attrs.id
            )
          )
        : undefined
    const image = page?.boxes.find(
      (box) => box.kind === "image" && box.block === block?.attrs.id
    )
    if (block?.type === "image" && page && image) {
      const { widthMpt, heightMpt } = block.attrs
      photoHandles.update({
        block: block.attrs.id,
        ...screenPoint({ ...image.rect, page: page.index }),
        w: px(image.rect.w) * scale,
        h: px(image.rect.h) * scale,
        widthMpt,
        heightMpt,
        maxWidthMpt: Math.min(
          page.content.w,
          Math.floor((page.content.h * widthMpt) / heightMpt)
        ),
      })
    } else {
      photoHandles.update(null)
    }
  }

  return {
    highlights,
    update,
    openFind(replace: boolean) {
      linkBubble.dismiss()
      findBar.open(replace)
    },
    openLink(
      doc: Document,
      here: Pos,
      collapsed: boolean,
      selectWord: () => Range
    ) {
      const active = collapsed ? linkAt(runsAt(doc, here), here) : null
      if (active) return linkBubble.begin(active.range, active.href, false)
      const target = selectWord()
      linkBubble.begin(target, "", samePos(target.from, target.to))
    },
    dismissLink: linkBubble.dismiss,
    destroy() {
      findBar.destroy()
      linkBubble.destroy()
      photoHandles.destroy()
      tableTools.destroy()
    },
  }
}
