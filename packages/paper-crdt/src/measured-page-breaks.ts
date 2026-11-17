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
  paragraph: {
    id: number
    line: number
    count: number
    keepTogether: boolean
    widowOrphan: boolean
  } | null
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
  const requiredEnd = (index: number): number => {
    const unit = units[index]!
    const paragraph = unit.paragraph
    let end = index
    if (paragraph) {
      const first = index - paragraph.line
      const last = first + paragraph.count - 1
      const minimum = paragraph.widowOrphan ? 2 : 1
      if (paragraph.line < minimum) end = Math.min(last, first + minimum - 1)
      else if (last - index < minimum) end = last
      if (
        ((paragraph.keepTogether && paragraph.line === 0) ||
          paragraph.count <= minimum * 2 - 1 ||
          (paragraph.line === 0 && unit.keepWithNext)) &&
        units[last]!.bottom - unit.top <= capacity + 0.1
      )
        end = last
    }
    if (
      units[end]?.keepWithNext &&
      (!units[end]!.paragraph ||
        units[end]!.paragraph!.line === units[end]!.paragraph!.count - 1) &&
      units[end + 1] &&
      units[end + 1]!.kind !== "break"
    ) {
      const next = requiredEnd(end + 1)
      if (units[next]!.bottom - unit.top <= capacity + 0.1) end = next
    }
    return units[end]!.bottom - unit.top <= capacity + 0.1 ? end : index
  }
  let shift = 0
  for (const [index, unit] of units.entries()) {
    const top = unit.top + shift
    const pageIndex = Math.max(0, Math.floor((top - page.top + 0.1) / pitch))
    const contentTop = pageIndex * pitch + page.top
    const contentBottom = pageIndex * pitch + page.height - page.bottom
    const bottom = units[requiredEnd(index)]!.bottom + shift
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
