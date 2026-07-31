import { Chip } from "@/components/shared/chip";
import { cn } from "@/lib/utils";
import type { ConnectedSourceStatus } from "@/lib/types";

const STATUS_STYLES: Record<ConnectedSourceStatus, { label: string; className: string; dot: string }> = {
  connected: {
    label: "Connected",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  "needs-attention": {
    label: "Needs attention",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "not-connected": {
    label: "Not connected",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

export function SourceStatusChip({ status, className }: { status: ConnectedSourceStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return <Chip label={style.label} dotClassName={style.dot} className={cn(style.className, className)} />;
}
