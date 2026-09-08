const PAPER_OPEN = ["sample"] as const
export type PaperOpen = (typeof PAPER_OPEN)[number]

function isPaperOpen(value: unknown): value is PaperOpen {
  return PAPER_OPEN.some((open) => open === value)
}

export function validatePaperSearch(search: Record<string, unknown>): {
  open?: PaperOpen
} {
  return isPaperOpen(search.open) ? { open: search.open } : {}
}
