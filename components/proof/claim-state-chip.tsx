import type { ClaimVerificationState } from "@/lib/types";
import { CLAIM_STATE_LABEL } from "@/lib/proof-utils";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";

// "No evidence yet" stays neutral rather than danger: the trust core's tone
// is supportive, never judgmental (docs/architecture.md's Proof Builder
// entry), so an unproven claim reads as an opportunity, not a failure.
const CLAIM_STATE_TONE: Record<ClaimVerificationState, keyof typeof CHIP_TONES> = {
  "well-supported": "success",
  "needs-stronger-proof": "warning",
  "no-evidence-yet": "muted",
};

export function ClaimStateChip({ state, className }: { state: ClaimVerificationState; className?: string }) {
  const tone = CHIP_TONES[CLAIM_STATE_TONE[state]];
  return <Chip label={CLAIM_STATE_LABEL[state]} dotClassName={tone.dot} className={cn(tone.className, className)} />;
}
