import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";

export type CredibilityVerdict = "pass" | "fail";

const CREDIBILITY_TONE: Record<CredibilityVerdict, keyof typeof CHIP_TONES> = {
  pass: "success",
  fail: "danger",
};

const CREDIBILITY_LABEL: Record<CredibilityVerdict, string> = {
  pass: "Passes checks",
  fail: "Fails checks",
};

/**
 * Shared credibility verdict chip, built on the same Chip primitive as
 * StatusChip, FitChip, PriorityChip, and ConfidenceChip. Used both by the AI
 * Analysis tab's validation layer and the opportunity summary band's
 * credibility flag, so the pass/fail color mapping lives in exactly one
 * place instead of being hand-rolled per surface.
 */
export function CredibilityChip({
  verdict,
  label,
  className,
}: {
  verdict: CredibilityVerdict;
  label?: string;
  className?: string;
}) {
  const tone = CHIP_TONES[CREDIBILITY_TONE[verdict]];
  return (
    <Chip
      label={label ?? CREDIBILITY_LABEL[verdict]}
      dotClassName={tone.dot}
      className={cn(tone.className, className)}
    />
  );
}
