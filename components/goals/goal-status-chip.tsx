import type { GoalStatus } from "@/lib/types";
import { Chip } from "@/components/shared/chip";
import { CHIP_TONES } from "@/components/shared/chip-tones";
import { cn } from "@/lib/utils";

const GOAL_STATUS_TONE: Record<GoalStatus, keyof typeof CHIP_TONES> = {
  "on track": "success",
  "needs attention": "warning",
  parked: "muted",
};

const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  "on track": "On track",
  "needs attention": "Needs attention",
  parked: "Parked",
};

export function GoalStatusChip({ status, className }: { status: GoalStatus; className?: string }) {
  const tone = CHIP_TONES[GOAL_STATUS_TONE[status]];
  return (
    <Chip
      label={GOAL_STATUS_LABEL[status]}
      dotClassName={tone.dot}
      className={cn(tone.className, className)}
    />
  );
}
