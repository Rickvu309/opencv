import type { RecruiterReadiness } from "@/lib/types";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { recruiterReadinessTone } from "@/lib/recruiter-utils";
import { cn } from "@/lib/utils";

export function RecruiterReadinessChip({ readiness, className }: { readiness: RecruiterReadiness; className?: string }) {
  const tone = CHIP_TONES[recruiterReadinessTone(readiness)];
  return <Chip label={readiness} dotClassName={tone.dot} className={cn(tone.className, className)} />;
}
