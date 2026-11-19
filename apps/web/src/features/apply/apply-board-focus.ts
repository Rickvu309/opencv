export type FocusKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"

export const FOCUS_KEYS: readonly FocusKey[] = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]

export function isFocusKey(key: string): key is FocusKey {
  return (FOCUS_KEYS as readonly string[]).includes(key)
}

export function stepFocus(
  columns: readonly (readonly string[])[],
  current: string | null,
  key: FocusKey
): string | null {
  const first = columns.find((column) => column.length > 0)?.[0] ?? null
  const col = current
    ? columns.findIndex((column) => column.includes(current))
    : -1
  if (col < 0) return first
  const column = columns[col] ?? []
  const row = column.indexOf(current as string)
  if (key === "ArrowDown") return column[Math.min(column.length - 1, row + 1)]!
  if (key === "ArrowUp") return column[Math.max(0, row - 1)]!
  const step = key === "ArrowLeft" ? -1 : 1
  for (
    let next = col + step;
    next >= 0 && next < columns.length;
    next += step
  ) {
    const target = columns[next] ?? []
    if (target.length > 0) return target[Math.min(row, target.length - 1)]!
  }
  return current
}
