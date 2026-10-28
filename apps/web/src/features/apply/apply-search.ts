export type ApplyView = "board" | "list" | "calendar"
export type ApplySpan = "month" | "week"

export type ApplyFilters = { company: string; location: string }

export function activeFilterCount(filters: ApplyFilters) {
  return (
    Number(filters.company.trim() !== "") +
    Number(filters.location.trim() !== "")
  )
}

export type ApplySearch = {
  view?: ApplyView
  span?: ApplySpan
}

function viewOf(value: unknown): ApplyView | undefined {
  if (value === "list" || value === "calendar") return value
  return undefined
}

function spanOf(value: unknown): ApplySpan | undefined {
  if (value === "month" || value === "week") return value
  return undefined
}

/** Unknown values fall back to the board. `open=guide` is dropped. */
export function validateApplySearch(
  search: Record<string, unknown>
): ApplySearch {
  const view = viewOf(search.view)
  const span = spanOf(search.span)
  const next: ApplySearch = {}
  if (view) next.view = view
  if (span) next.span = span
  return next
}
