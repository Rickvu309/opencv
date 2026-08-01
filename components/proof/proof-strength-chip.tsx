import type { ProofStrengthLevel } from "@/lib/types";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";

// Reuses the shared tone table FitChip already draws from, not the FitChip
// component itself, so "Strong proof" never accidentally borrows the word
// "fit" the way lessons.md #24 already named as a pitfall.
const STRENGTH_TONE: Record<ProofStrengthLevel, keyof typeof CHIP_TONES> = {
  Strong: "success",
  Medium: "warning",
  Weak: "danger",
};

const STRENGTH_LABEL: Record<ProofStrengthLevel, string> = {
  Strong: "Strong proof",
  Medium: "Medium proof",
  Weak: "Weak proof",
};

export function ProofStrengthChip({ strength, className }: { strength: ProofStrengthLevel; className?: string }) {
  const tone = CHIP_TONES[STRENGTH_TONE[strength]];
  return <Chip label={STRENGTH_LABEL[strength]} dotClassName={tone.dot} className={cn(tone.className, className)} />;
}
