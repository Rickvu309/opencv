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
  company?: string
  location?: string
}

function viewOf(value: unknown): ApplyView | undefined {
  if (value === "list" || value === "calendar") return value
  return undefined
}

function spanOf(value: unknown): ApplySpan | undefined {
  if (value === "month" || value === "week") return value
  return undefined
}

export function validateApplySearch(search: object): ApplySearch {
  const view = viewOf("view" in search ? search.view : undefined)
  const span = spanOf("span" in search ? search.span : undefined)
  const next: ApplySearch = {}
  if (view) next.view = view
  if (span) next.span = span
  if (
    "company" in search &&
    typeof search.company === "string" &&
    search.company !== ""
  ) {
    next.company = search.company
  }
  if (
    "location" in search &&
    typeof search.location === "string" &&
    search.location !== ""
  ) {
    next.location = search.location
  }
  return next
}
