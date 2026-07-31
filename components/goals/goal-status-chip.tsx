import type { GoalStatus } from "@/lib/types";
import { Chip } from "@/components/shared/chip";

const GOAL_STATUS_STYLES: Record<GoalStatus, { className: string; dot: string; label: string }> = {
  "on track": {
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "On track",
  },
  "needs attention": {
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "Needs attention",
  },
  parked: {
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    label: "Parked",
  },
};

export function GoalStatusChip({ status, className }: { status: GoalStatus; className?: string }) {
  const style = GOAL_STATUS_STYLES[status];
  return (
    <Chip
      label={style.label}
      dotClassName={style.dot}
      className={className ? `${style.className} ${className}` : style.className}
    />
  );
}
