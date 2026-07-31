"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FitChip } from "@/components/shared/fit-chip";
import { StatusChip } from "@/components/shared/status-chip";
import { comparisonGridTemplate } from "@/lib/comparison-utils";
import { findPrimaryNextAction } from "@/lib/opportunity-utils";
import { useStore } from "@/lib/store";
import type { Opportunity } from "@/lib/types";

/**
 * Serial Position: the candidates themselves lead the page, pinned while the
 * dimension grid scrolls under them, so role, company, status, fit, and the
 * current next action stay visible no matter how far down the grid you've
 * scrolled. Shares comparisonGridTemplate with ComparisonDimensionGrid so a
 * candidate's card lines up exactly above its own column of cells.
 */
export function ComparisonHeaderCards({ opportunities }: { opportunities: Opportunity[] }) {
  const { state } = useStore();

  return (
    <div className="sticky top-0 z-20 -mx-6 bg-background px-6 pb-4 pt-1">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Comparing {opportunities.length} opportunities</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/opportunities?compare=1">Change selection</Link>
        </Button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: comparisonGridTemplate(opportunities.length) }}>
        <div aria-hidden />
        {opportunities.map((opportunity) => {
          const nextAction = findPrimaryNextAction(opportunity.id, state.nextActions);
          return (
            <Link key={opportunity.id} href={`/opportunities/${opportunity.id}`} className="block min-w-0">
              <Card size="sm" className="gap-2 transition-colors hover:ring-foreground/20">
                <CardContent className="flex flex-col gap-1.5 px-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {opportunity.isDream ? (
                      <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
                    ) : null}
                    <span className="truncate text-sm font-medium text-foreground">{opportunity.role}</span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{opportunity.company}</span>
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusChip status={opportunity.status} />
                    <FitChip fit={opportunity.fit} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {nextAction ? nextAction.verb : "No next action suggested yet."}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
