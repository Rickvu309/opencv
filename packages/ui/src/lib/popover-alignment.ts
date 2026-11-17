type Alignment = "start" | "center" | "end"

export function popoverCoordinate(position: number, pixelRatio: number) {
  return Math.round(position * pixelRatio) / pixelRatio
}

export function popoverAlignment({
  align,
  start,
  anchorSize,
  popupSize,
  viewportStart,
  viewportSize,
  offset,
  padding,
  reverse,
}: {
  align: Alignment
  start: number
  anchorSize: number
  popupSize: number
  viewportStart: number
  viewportSize: number
  offset: number
  padding: number
  reverse: boolean
}): Alignment {
  if (align === "center") return align
  const position = (candidate: Alignment) =>
    (candidate === "start") !== reverse
      ? start + offset
      : start + anchorSize - popupSize - offset
  const overflow = (position: number) =>
    Math.max(0, viewportStart + padding - position) +
    Math.max(0, position + popupSize - (viewportStart + viewportSize - padding))
  const other = align === "start" ? "end" : "start"
  return overflow(position(other)) < overflow(position(align)) ? other : align
}
