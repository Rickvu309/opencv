import type { DiffHunk } from "@workspace/domain"

export const SUGGESTION_ACCEPT = "Accept"
export const SUGGESTION_REJECT = "Reject"

export type PaperSuggestion = {
  previous: unknown
  sections: string[]
}

/** Keeps the content from before the first unreviewed Coach edit, so Reject undoes all of them. */
export function addSuggestion(
  current: PaperSuggestion | null,
  previous: unknown,
  hunks: readonly DiffHunk[]
): PaperSuggestion | null {
  if (hunks.length === 0) return current
  const sections = new Set(current?.sections)
  for (const hunk of hunks) sections.add(hunk.section)
  return {
    previous: current ? current.previous : previous,
    sections: [...sections],
  }
}

export function suggestionSentence(sections: readonly string[]): string {
  if (sections.length === 0) return "Coach changed this."
  const head = sections.slice(0, -1)
  const last = sections[sections.length - 1]
  return `Coach changed ${head.length ? `${head.join(", ")} and ${last}` : last}.`
}
