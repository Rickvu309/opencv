export function contentCenterShift(
  content: { left: number; width: number },
  viewportWidth: number
) {
  if (viewportWidth <= 0 || content.width <= 0) return 0
  return Math.round(content.left + content.width / 2 - viewportWidth / 2)
}
