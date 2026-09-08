import {
  STARTER_GUIDED_APPLY_COMPANY,
  STARTER_GUIDED_APPLY_TITLE,
  type ApplyStage,
  type ApplyTrackKind,
} from "@workspace/domain"

export const GUIDED_APPLY_PREP_ACTION = "Move to Prep"

export type GuidedApplyCardPick = {
  id: string
  title: string
  company: string
  stage: ApplyStage
  starred: boolean
  trackKind: ApplyTrackKind
}

export type GuidedApplyAction =
  | { kind: "stage"; stage: "prep"; label: "Prep" }
  | { kind: "track"; trackKind: "followup"; label: "Follow-up" }

const ACTIONABLE_STAGES: ReadonlySet<ApplyStage> = new Set(["inbox", "prep"])

/**
 * One seeded card to poke — never empty the board or invent a tour card.
 * Prefer the starred Inbox starter; fall back to another Inbox/Prep card.
 */
export function pickGuidedApplyCard<T extends GuidedApplyCardPick>(
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

/** Inbox first win is the Prep column; Prep cards keep the Follow-up Track. */
export function guidedApplyNextAction(card: {
  stage: ApplyStage
}): GuidedApplyAction {
  if (card.stage === "inbox") {
    return { kind: "stage", stage: "prep", label: "Prep" }
  }
  return { kind: "track", trackKind: "followup", label: "Follow-up" }
}
