import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { CopilotTag } from "@/components/shared/copilot-tag";

interface ReviewQueueProps {
  title: string;
  count: number;
  emptyMessage: string;
  children: ReactNode;
  className?: string;
}

/**
 * A list of AiActionCards with a count header, the shared shell around the
 * five-beat pattern wherever a surface offers more than one AI proposal at
 * once: opportunity Signals, the Home attention queue.
 */
export function ReviewQueue({ title, count, emptyMessage, children, className }: ReviewQueueProps) {
  return (
    <section className={className ? `flex flex-col gap-3 ${className}` : "flex flex-col gap-3"}>
      <div className="flex items-center gap-2">
        <h2>{title}</h2>
        <CopilotTag />
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
      </div>
      {count === 0 ? <EmptyState message={emptyMessage} /> : <div className="flex flex-col gap-3">{children}</div>}
    </section>
  );
}
