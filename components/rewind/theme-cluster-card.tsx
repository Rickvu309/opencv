"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { RewindThemeCluster } from "@/lib/types";

interface ThemeClusterCardProps {
  cluster: RewindThemeCluster;
}

/**
 * One compact theme cluster in the week's story: title, its activity count,
 * and the product-activity-plus-connected-items source mix, collapsed by
 * default (Progressive Disclosure) and expandable to the underlying moments.
 */
export function ThemeClusterCard({ cluster }: ThemeClusterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const total = cluster.productActivityCount + cluster.connectedItemCount;

  return (
    <Card size="sm" className="bg-background/60">
      <CardContent className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-sm font-medium text-foreground">{cluster.title}</p>
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "moment" : "moments"} &middot; {cluster.productActivityCount} activity, {" "}
              {cluster.connectedItemCount} connected
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
        {expanded ? (
          <ul className="flex flex-col gap-1.5 border-t border-border pt-2">
            {cluster.moments.map((moment) => (
              <li key={moment} className="text-xs text-muted-foreground">
                {moment}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
