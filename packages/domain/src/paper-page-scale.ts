export function scalePaperPage(
  width: number,
  height: number,
  available: number
) {
  const scale = Math.min(1, Math.max(1, available) / width)
  return { scale, width: width * scale, height: height * scale }
}
