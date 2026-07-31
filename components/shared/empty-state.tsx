import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * One line of guidance plus an action, used for every empty list or empty
 * detail surface so the product never shows a blank page.
 */
export function EmptyState({ message, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-10 text-center",
        className
      )}
    >
      {icon}
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
