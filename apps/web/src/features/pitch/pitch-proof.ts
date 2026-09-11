import {
  STARTER_CHECKOUT_ACHIEVEMENT_TITLE,
  STARTER_CHECKOUT_PROOF_ID,
  type PitchAchievement,
  type ProofDocument,
} from "@workspace/domain"

import { DEFAULT_CHECKOUT_PROOF } from "@/features/paper/paper-proof-types.ts"

export const PITCH_CHECKOUT_PROOF_ID = STARTER_CHECKOUT_PROOF_ID

const PROOFS: Record<string, ProofDocument> = {
  [PITCH_CHECKOUT_PROOF_ID]: DEFAULT_CHECKOUT_PROOF,
}

/** Starter / already-persisted titles that map to a real Proof. */
const TITLE_TO_PROOF_ID: Record<string, string> = {
  [STARTER_CHECKOUT_ACHIEVEMENT_TITLE]: PITCH_CHECKOUT_PROOF_ID,
}

function proofFromId(id: string | undefined): ProofDocument | null {
  if (!id || id === "#") return null
  return PROOFS[id] ?? null
}

/**
 * Honest CTA source: only a resolvable Proof. Dead hrefs (`#`) never count.
 * Title fallback covers Pitch docs persisted before proofId existed.
 */
export function resolveAchievementProof(
  item: Pick<PitchAchievement, "title" | "link" | "proofId">
): ProofDocument | null {
  return (
    proofFromId(item.proofId) ??
    proofFromId(TITLE_TO_PROOF_ID[item.title]) ??
    proofFromId(item.link)
  )
}
