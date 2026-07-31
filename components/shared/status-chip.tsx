import type { OpportunityStatus } from "@/lib/types";
import { Chip } from "@/components/shared/chip";

const STATUS_STYLES: Record<OpportunityStatus, { className: string; dot: string }> = {
  Saved: { className: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300", dot: "bg-slate-500" },
  Applied: { className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", dot: "bg-sky-500" },
  Interview: { className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500" },
  Offer: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500" },
  Closed: { className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

export function StatusChip({ status, className }: { status: OpportunityStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <Chip
      label={status}
      dotClassName={style.dot}
      className={className ? `${style.className} ${className}` : style.className}
    />
  );
}
