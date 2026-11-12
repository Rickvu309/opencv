export const ZOOM = Object.freeze({
  factor: 3,
  smallChange: 8,
  smallElement: 40,
  pad: 12,
  maxWidth: 144,
  maxHeight: 80,
})

const usable = (box) => box && box.width > 0 && box.height > 0

export function needsZoom(before, after) {
  if (!usable(before) || !usable(after)) return false
  const moved = ["x", "y", "width", "height"].map((key) =>
    Math.abs(before[key] - after[key])
  )
  const smallChange = moved.every((delta) => delta < ZOOM.smallChange)
  const smallElement = [before, after].some(
    (box) => Math.min(box.width, box.height) < ZOOM.smallElement
  )
  return smallChange || smallElement
}

function fit(left, top, width, height, bounds) {
  return {
    x: Math.round(Math.min(Math.max(0, left), bounds.width - width)),
    y: Math.round(Math.min(Math.max(0, top), bounds.height - height)),
    width: Math.round(width),
    height: Math.round(height),
  }
}

export function zoomRects(before, after, bounds) {
  const left = Math.min(before.x, after.x) - ZOOM.pad
  const top = Math.min(before.y, after.y) - ZOOM.pad
  const right =
    Math.max(before.x + before.width, after.x + after.width) + ZOOM.pad
  const bottom =
    Math.max(before.y + before.height, after.y + after.height) + ZOOM.pad
  if (right - left <= ZOOM.maxWidth && bottom - top <= ZOOM.maxHeight) {
    const shared = fit(left, top, right - left, bottom - top, bounds)
    return { before: shared, after: shared }
  }
  const width = Math.min(
    Math.max(before.width, after.width) + ZOOM.pad * 2,
    ZOOM.maxWidth,
    bounds.width
  )
  const height = Math.min(
    Math.max(before.height, after.height) + ZOOM.pad * 2,
    ZOOM.maxHeight,
    bounds.height
  )
  const around = (box) =>
    fit(box.x - ZOOM.pad, box.y - ZOOM.pad, width, height, bounds)
  return { before: around(before), after: around(after) }
}

const inCss = (box, scale) =>
  box && {
    x: box.x / scale,
    y: box.y / scale,
    width: box.width / scale,
    height: box.height / scale,
  }

export function calloutZooms(callouts, sides) {
  const zooms = new Map()
  const scale = (side) => sides[side].scale ?? 1
  const bounds = {
    width: Math.min(
      ...["before", "after"].map((side) => sides[side].size.width / scale(side))
    ),
    height: Math.min(
      ...["before", "after"].map(
        (side) => sides[side].size.height / scale(side)
      )
    ),
  }
  for (const { n } of callouts) {
    const before = inCss(sides.before.boxes.get(n), scale("before"))
    const after = inCss(sides.after.boxes.get(n), scale("after"))
    if (!needsZoom(before, after)) continue
    zooms.set(n, {
      rects: zoomRects(before, after, bounds),
      targets: { before, after },
    })
  }
  return zooms
}
