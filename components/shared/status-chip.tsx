import type { OpportunityStatus } from "@/lib/types";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";

/**
 * Opportunity status is a 5-stage pipeline, not a sentiment, so it keeps
 * two hues of its own (sky for Applied, violet for Interview) alongside the
 * shared tone table: Saved and Closed are genuinely neutral/muted, Offer is
 * genuinely a success, but "in progress" has no honest success/warning/
 * danger meaning, it's just further along.
 */
const IN_PROGRESS_TONES: Record<"Applied" | "Interview", { className: string; dot: string }> = {
  Applied: { className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500" },
  Interview: { className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500" },
};

const STATUS_STYLES: Record<OpportunityStatus, { className: string; dot: string }> = {
  Saved: CHIP_TONES.neutral,
  Applied: IN_PROGRESS_TONES.Applied,
  Interview: IN_PROGRESS_TONES.Interview,
  Offer: CHIP_TONES.success,
  Closed: CHIP_TONES.muted,
};

export function StatusChip({ status, className }: { status: OpportunityStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <Chip
      label={status}
      dotClassName={style.dot}
      className={cn(style.className, className)}
    />
  );
}
