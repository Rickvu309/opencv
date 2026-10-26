import {
  STARTER_GUIDED_APPLY_COMPANY,
  STARTER_GUIDED_APPLY_TITLE,
  type ApplyStage,
  type ApplyTrackKind,
  type PaperDoc,
} from "@workspace/domain"

import { paperDocToLink } from "./paper-data.ts"

export type GuidedApplyCardPick = {
  id: string
  title: string
  company: string
  stage: ApplyStage
  starred: boolean
  trackKind: ApplyTrackKind
}

const ACTIONABLE_STAGES: ReadonlySet<ApplyStage> = new Set(["inbox", "prep"])

function pickGuidedApplyCard<T extends GuidedApplyCardPick>(
  cards: readonly T[]
): T | null {
  const pool = cards.filter((card) => ACTIONABLE_STAGES.has(card.stage))
  if (pool.length === 0) return null
  const starter = pool.find(
    (card) =>
      card.title === STARTER_GUIDED_APPLY_TITLE &&
      card.company === STARTER_GUIDED_APPLY_COMPANY
  )
  if (starter) return starter
  return (
    pool.find((card) => card.stage === "inbox" && card.starred) ??
    pool.find((card) => card.stage === "inbox") ??
    pool.find((card) => card.trackKind === "followup") ??
    pool[0] ??
    null
  )
}

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
