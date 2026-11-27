import { useLayoutEffect, useReducer, useRef } from "react"

const FOLD_ORDER = [
  "Redo",
  "Link",
  "Undo",
  "Align",
  "Numbered list",
  "Underline",
] as const

export type FoldableTool = (typeof FOLD_ORDER)[number]

type FoldRow = {
  room: number
  gap: number
  items: readonly { tool: string | null; width: number }[]
}

const used = (row: FoldRow, items: FoldRow["items"]) =>
  items.reduce((sum, item) => sum + item.width, 0) +
  row.gap * Math.max(0, items.length - 1)

function foldTools(
  rows: readonly FoldRow[],
  order: readonly FoldableTool[] = FOLD_ORDER
): FoldableTool[] {
  const folded: FoldableTool[] = []
  for (const row of rows) {
    const items = [...row.items]
    for (const tool of order) {
      if (used(row, items) <= row.room + 0.5) break
      const at = items.findIndex((item) => item.tool === tool)
      if (at < 0) continue
      items.splice(at, 1)
      folded.push(tool)
    }
  }
  return FOLD_ORDER.filter((tool) => folded.includes(tool))
}

const px = (value: string) => parseFloat(value) || 0

function extent(element: HTMLElement) {
  const style = getComputedStyle(element)
  if (style.display === "none") return null
  return (
    element.getBoundingClientRect().width +
    px(style.marginLeft) +
    px(style.marginRight)
  )
}

function measureRows(bar: HTMLElement): FoldRow[] {
  const groups = [...bar.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  )
  const flat = groups.every(
    (group) => getComputedStyle(group).display === "contents"
  )
  const rows = flat ? [bar] : groups
  return rows.map((row) => {
    const style = getComputedStyle(row)
    const children = (flat ? groups : [row]).flatMap((group) => [
      ...group.children,
    ])
    return {
      room: row.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
      gap: px(style.columnGap),
      items: children.flatMap((child) => {
        if (!(child instanceof HTMLElement)) return []
        const width = extent(child)
        return width === null
          ? []
          : [{ tool: child.dataset.fold ?? null, width }]
      }),
    }
  })
}

function measureUnfolded(bar: HTMLElement): FoldRow[] {
  const folded = [...bar.querySelectorAll<HTMLElement>("[data-folded]")]
  for (const element of folded) element.removeAttribute("data-folded")
  const rows = measureRows(bar)
  for (const element of folded) element.setAttribute("data-folded", "")
  return rows
}

function foldReducer(
  state: readonly FoldableTool[],
  next: readonly FoldableTool[]
): readonly FoldableTool[] {
  return state.length === next.length &&
    state.every((tool, index) => tool === next[index])
    ? state
    : next
}

export function useToolbarFold(labels: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [folded, dispatch] = useReducer(foldReducer, [])
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar) return
    const run = () => dispatch(foldTools(measureUnfolded(bar)))
    run()
    const observer = new ResizeObserver(run)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [labels])
  return { ref, folded }
}
