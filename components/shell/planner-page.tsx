import type { ReactNode } from "react";

import { PageHeader, type PageHeaderProps } from "@/components/shell/page-header";
import { cn } from "@/lib/utils";

export interface PlannerPageProps extends PageHeaderProps {
  /** Full-bleed content directly under the header, edge to edge, no padding. */
  band?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Template for forward-looking planning surfaces: Goals, Skills & Learning,
 * and future planner pages. Same max-width and padding scale as Home
 * (max-w-6xl) since these are also section-stacked reading surfaces, not
 * wide tables or boards. Shares the same header anatomy as the other three
 * templates.
 */
export function PlannerPage({ title, description, primaryAction, band, children, className }: PlannerPageProps) {
  return (
    <div className="flex flex-col">
      <PageHeader title={title} description={description} primaryAction={primaryAction} />
      {band}
      <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6 p-6", className)}>{children}</div>
    </div>
  );
}
