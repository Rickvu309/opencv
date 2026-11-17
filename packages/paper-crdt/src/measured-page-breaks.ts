export type PageMetrics = {
  height: number
  top: number
  bottom: number
  gap: number
}

export type LayoutUnit = {
  pos: number
  end: number
  top: number
  bottom: number
  kind: "line" | "block" | "row" | "break"
  keepWithNext: boolean
}

export type PageOffset = {
  pos: number
  end: number
  height: number
  kind: LayoutUnit["kind"]
}

export function measuredPageBreaks(
  units: readonly LayoutUnit[],
  page: PageMetrics
): PageOffset[] {
  const offsets: PageOffset[] = []
  const pitch = page.height + page.gap
  const capacity = page.height - page.top - page.bottom
  let shift = 0
  for (const [index, unit] of units.entries()) {
    const top = unit.top + shift
    const pageIndex = Math.max(0, Math.floor((top - page.top + 0.1) / pitch))
    const contentTop = pageIndex * pitch + page.top
    const contentBottom = pageIndex * pitch + page.height - page.bottom
    let bottom = unit.bottom + shift
    const next = units[index + 1]
    if (unit.keepWithNext && next && next.kind !== "break")
      bottom = Math.min(next.bottom + shift, top + capacity)
    const target =
      unit.kind === "break"
        ? contentTop + pitch
        : top < contentTop - 0.1
          ? contentTop
          : bottom > contentBottom + 0.1 && top > contentTop + 0.1
            ? contentTop + pitch
            : top
    const height = Math.max(0, target - top)
    if (height > 0.1) {
      offsets.push({
        pos: unit.pos,
        end: unit.end,
        height,
        kind: unit.kind,
      })
      shift += height
    }
  }
  return offsets
}
