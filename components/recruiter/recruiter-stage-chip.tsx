import type { RecruiterStage } from "@/lib/types";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";

// Stage is a 6-step pipeline, not a sentiment, the same reasoning
// StatusChip already documents for Opportunity's own 5-stage status: Sourced
// and Closed are genuinely neutral/muted, Hired is genuinely a success, but
// Screening and Interview are just "further along" and keep their own hues,
// while Offer borrows the shared warning tone on purpose, an offer always
// needs a decision, the same "needs attention" meaning warning already
// carries in docs/design.md.
const IN_PROGRESS_TONES: Record<"Screening" | "Interview", { className: string; dot: string }> = {
  Screening: { className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500" },
  Interview: { className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500" },
};

const STAGE_STYLES: Record<RecruiterStage, { className: string; dot: string }> = {
  Sourced: CHIP_TONES.neutral,
  Screening: IN_PROGRESS_TONES.Screening,
  Interview: IN_PROGRESS_TONES.Interview,
  Offer: CHIP_TONES.warning,
  Hired: CHIP_TONES.success,
  Closed: CHIP_TONES.muted,
};

export function RecruiterStageChip({ stage, className }: { stage: RecruiterStage; className?: string }) {
  const style = STAGE_STYLES[stage];
  return <Chip label={stage} dotClassName={style.dot} className={cn(style.className, className)} />;
}
