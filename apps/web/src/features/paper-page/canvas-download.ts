import type { DraftBasis } from "./canvas-edit.ts"

export function wordDownloadRevision(
  note: string,
  words: string,
  basis: DraftBasis | null
): string | null {
  if (note !== "Saved" || !basis?.revision || words !== basis.words) return null
  return basis.revision
}
