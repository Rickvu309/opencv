const ENDS = [
  ["pointercancel", /onPointerCancel|pointercancel/],
  ["lostpointercapture", /onLostPointerCapture|lostpointercapture/],
]

export function missingDragEnds(source) {
  if (!/\bsetPointerCapture\s*\(/.test(source)) return []
  return ENDS.filter(([, pattern]) => !pattern.test(source)).map(
    ([name]) => name
  )
}
