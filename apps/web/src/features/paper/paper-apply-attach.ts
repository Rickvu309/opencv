import type { PaperDoc } from "@workspace/domain"

import {
  pickGuidedApplyCard,
  type GuidedApplyCardPick,
} from "@/features/apply/apply-guide.ts"

import { paperDocToLink } from "./paper-data.ts"

export type PaperAttachPair<T extends GuidedApplyCardPick> = {
  doc: PaperDoc
  card: T
}

/**
 * One attach path: Sample CV (or first CV) → the seeded guided Apply card.
 * Does not invent a card or open a picker.
 */
export function paperAttachPair<T extends GuidedApplyCardPick>(
  docs: readonly PaperDoc[],
  cards: readonly T[]
): PaperAttachPair<T> | null {
  const doc = paperDocToLink(docs)
  const card = pickGuidedApplyCard(cards)
  if (!doc || !card) return null
  return { doc, card }
}

export function paperDocsLinkedToCard(
  docs: readonly PaperDoc[],
  cardId: string
): PaperDoc[] {
  return docs.filter((doc) => doc.applyCardId === cardId)
}
