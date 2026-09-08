export const APPLY_OPEN_GUIDE = "guide" as const
export type ApplyOpen = typeof APPLY_OPEN_GUIDE

function isApplyOpen(value: unknown): value is ApplyOpen {
  return value === APPLY_OPEN_GUIDE
}

export function validateApplySearch(search: Record<string, unknown>): {
  open?: ApplyOpen
} {
  return isApplyOpen(search.open) ? { open: search.open } : {}
}
