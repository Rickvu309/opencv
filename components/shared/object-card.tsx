import type { ReactNode } from "react";
import Link from "next/link";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ObjectCardProps {
  title: string;
  subtitle?: string;
  href?: string;
  chips?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Standard card anatomy shared by opportunity, CV, track record, goal, and
 * skill cards: title and subtitle, a chip row, optional meta line, an
 * optional corner action, and a body slot for anything object-specific.
 */
export function ObjectCard({ title, subtitle, href, chips, meta, action, children, className }: ObjectCardProps) {
  const content = (
    <>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <CardTitle>{title}</CardTitle>
            {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
          </div>
          {action ? <CardAction>{action}</CardAction> : null}
        </div>
        {chips ? <div className="flex flex-wrap items-center gap-1.5">{chips}</div> : null}
      </CardHeader>
      {children ? <CardContent className="flex flex-col gap-2">{children}</CardContent> : null}
      {meta ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">{meta}</CardContent>
      ) : null}
    </>
  );

  const cardClassName = cn(
    "ring-foreground/8 transition-colors",
    href && "hover:ring-foreground/20 hover:bg-accent/40",
    className
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className={cardClassName}>{content}</Card>
      </Link>
    );
  }

  return <Card className={cardClassName}>{content}</Card>;
}
