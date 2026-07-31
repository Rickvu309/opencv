import type { FitLevel } from "@/lib/types";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";

const FIT_TONE: Record<FitLevel, keyof typeof CHIP_TONES> = {
  Strong: "success",
  Medium: "warning",
  Weak: "danger",
  Unknown: "muted",
};

const FIT_LABEL: Record<FitLevel, string> = {
  Strong: "Strong fit",
  Medium: "Medium fit",
  Weak: "Weak fit",
  Unknown: "Unknown fit",
};

export function FitChip({ fit, className }: { fit: FitLevel; className?: string }) {
  const tone = CHIP_TONES[FIT_TONE[fit]];
  return (
    <Chip
      label={FIT_LABEL[fit]}
      dotClassName={tone.dot}
      className={cn(tone.className, className)}
    />
  );
}
