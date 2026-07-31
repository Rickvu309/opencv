import type { ReactNode } from "react";

import { PageHeader, type PageHeaderProps } from "@/components/shell/page-header";
import { cn } from "@/lib/utils";

export interface WorkspacePageProps extends PageHeaderProps {
  /** Full-bleed content directly under the header, edge to edge, no padding. */
  band?: ReactNode;
  /** A quiet support rail beside the primary content, standardized to w-72. */
  rail?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Template for the object-listing workspaces: Opportunities, Sources, CV
 * Versions, Track Record. Wider than a dashboard (max-w-[1600px]) so board
 * and table layouts have room, still capped so nothing stretches
 * unreasonably wide on ultra-wide monitors. Shares the same header anatomy
 * and padding scale as the other three templates.
 */
export function WorkspacePage({
  title,
  description,
  primaryAction,
  band,
  rail,
  children,
  className,
}: WorkspacePageProps) {
  return (
    <div className="flex flex-col">
      <PageHeader title={title} description={description} primaryAction={primaryAction} />
      {band}
      <div className={cn("mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-6", className)}>
        {rail ? (
          <div className="flex items-start gap-6">
            <div className="min-w-0 flex-1">{children}</div>
            <div className="flex w-72 shrink-0 flex-col gap-3">{rail}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
