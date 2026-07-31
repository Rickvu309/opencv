import type { ReactNode } from "react";

import { PageHeader, type PageHeaderProps } from "@/components/shell/page-header";
import { cn } from "@/lib/utils";

export interface DashboardPageProps extends PageHeaderProps {
  children: ReactNode;
  className?: string;
}

/**
 * Template for Home: the one dashboard surface in the product. Narrower
 * than a workspace (max-w-6xl) so stat tiles and the attention queue read
 * as a five-second glance, not a document, and share the same header
 * anatomy and padding scale as every other template.
 */
export function DashboardPage({ title, description, primaryAction, children, className }: DashboardPageProps) {
  return (
    <div className="flex flex-col">
      <PageHeader title={title} description={description} primaryAction={primaryAction} />
      <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6 p-6", className)}>{children}</div>
    </div>
  );
}
