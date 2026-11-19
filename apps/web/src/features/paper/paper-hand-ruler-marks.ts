const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
const LABEL_GAP_PX = 52
const END_GAP_PX = 30

export const RULER_WIDTH_PX = 440
export const RULER_NARROW_WIDTH_PX = 280

export function rulerShown(total: number) {
  return total > 7
}

export function rulerOffset(number: number, total: number) {
  if (total <= 1) return 50
  return ((number - 1) / (total - 1)) * 100
}

export function rulerMarks(total: number, width: number) {
  if (total <= 1) return [1]
  const span = total - 1
  const px = (mark: number) => (width * (mark - 1)) / span
  const step =
    STEPS.find((k) => (width * k) / span >= LABEL_GAP_PX) ??
    STEPS[STEPS.length - 1]
  const marks = [1]
  for (let k = step; k < total; k += step)
    if (px(k) - px(marks[marks.length - 1]) >= LABEL_GAP_PX) marks.push(k)
  const last = marks[marks.length - 1]
  if (marks.length > 1 && px(total) - px(last) < END_GAP_PX) marks.pop()
  marks.push(total)
  return marks
}

export function rulerTicks(total: number, marks: readonly number[]) {
  if (total <= 150)
    return Array.from({ length: total }, (_, index) => index + 1)
  const step = Math.max(
    1,
    Math.round(((marks[2] ?? total) - (marks[1] ?? 1)) / 5)
  )
  const ticks: number[] = []
  for (let k = 1; k <= total; k += step) ticks.push(k)
  return ticks
}

export function rulerNumberAt(fraction: number, total: number) {
  const clamped = Math.min(1, Math.max(0, fraction))
  return Math.round(clamped * (total - 1)) + 1
}
