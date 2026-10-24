import type { DiffHunk } from "@workspace/domain"

export const SUGGESTION_KEEP = "Keep"
export const SUGGESTION_UNDO = "Undo this change"

export type PaperSuggestion = {
  previous: unknown
  sections: string[]
  sectionIds: string[]
}

/** Keeps the content from before the first unreviewed Coach edit, so Undo this change restores all of them. */
export function addSuggestion(
  current: PaperSuggestion | null,
  previous: unknown,
  hunks: readonly DiffHunk[]
): PaperSuggestion | null {
  if (hunks.length === 0) return current
  const sections = new Set(current?.sections)
  const sectionIds = new Set(current?.sectionIds)
  for (const hunk of hunks) {
    sections.add(hunk.section)
    sectionIds.add(hunk.sectionId)
  }
  return {
    previous: current ? current.previous : previous,
    sections: [...sections],
    sectionIds: [...sectionIds],
  }
}

export function suggestionSentence(sections: readonly string[]): string {
  if (sections.length === 0) return "Coach changed this. Keep it or undo it."
  const head = sections.slice(0, -1)
  const last = sections[sections.length - 1]
  const named = head.length ? `${head.join(", ")} and ${last}` : last
  return `Coach changed ${named}. Keep it or undo this change.`
}
