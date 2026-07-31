import type { Priority } from "@/lib/types";
import { Chip } from "@/components/shared/chip";

const PRIORITY_STYLES: Record<Priority, { className: string; dot: string; label: string }> = {
  High: { className: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300", dot: "bg-rose-500", label: "High priority" },
  Medium: { className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", dot: "bg-amber-500", label: "Medium priority" },
  Low: { className: "bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400", dot: "bg-slate-400", label: "Low priority" },
};

export function PriorityChip({ priority, className }: { priority: Priority; className?: string }) {
  const style = PRIORITY_STYLES[priority];
  return (
    <Chip
      label={style.label}
      dotClassName={style.dot}
      className={className ? `${style.className} ${className}` : style.className}
    />
  );
}
