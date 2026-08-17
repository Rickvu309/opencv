import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title?: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-6", className)}>
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      {body && (
        <p className={cn("text-pretty text-sm text-foreground", title && "mt-1")}>
          {body}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
