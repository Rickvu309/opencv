"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { FitChip } from "@/components/shared/fit-chip";
import { AiSignalGlyph } from "@/components/opportunities/ai-signal-glyph";
import { ComparisonCheckbox } from "@/components/opportunities/comparison-checkbox";
import { MoveToActiveDialog } from "@/components/opportunities/move-to-active-dialog";
import { OpportunityQuickActionsMenu } from "@/components/opportunities/opportunity-quick-actions-menu";
import { buildWatchlistReason, countPendingSignals } from "@/lib/opportunity-utils";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/lib/types";
import type { OpportunitiesView } from "@/lib/store";

interface WatchlistViewProps {
  opportunities: Opportunity[];
  view: OpportunitiesView;
  highlightedId?: string;
}

/**
 * Watchlist mode's own quieter surface (section 2): no stage columns, a
 * curated grid or dense list depending on the same view toggle Active
 * uses, each item down to role, company, fit, one "why it is here" line,
 * and two actions, Move to Active and Archive. Compare-mode checkboxes and
 * the full quick-actions menu still work here (section 5), the two named
 * buttons are just the primary, visible path.
 */
export function WatchlistView({ opportunities, view, highlightedId }: WatchlistViewProps) {
  const [moveTarget, setMoveTarget] = useState<Opportunity | null>(null);

  if (opportunities.length === 0) {
    return (
      <EmptyState message="Nothing on the watchlist right now. Dream-flagged or freshly saved opportunities with no active work land here." />
    );
  }

  return (
    <>
      {view === "board" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {opportunities.map((opportunity) => (
            <WatchlistCard
              key={opportunity.id}
              opportunity={opportunity}
              highlighted={opportunity.id === highlightedId}
              onMoveToActive={() => setMoveTarget(opportunity)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Role and company</TableHead>
                <TableHead>Fit</TableHead>
                <TableHead>Why it&apos;s here</TableHead>
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Signals</span>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opportunity) => (
                <WatchlistRow
                  key={opportunity.id}
                  opportunity={opportunity}
                  highlighted={opportunity.id === highlightedId}
                  onMoveToActive={() => setMoveTarget(opportunity)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <MoveToActiveDialog opportunity={moveTarget} onClose={() => setMoveTarget(null)} />
    </>
  );
}

function WatchlistCard({
  opportunity,
  highlighted,
  onMoveToActive,
}: {
  opportunity: Opportunity;
  highlighted: boolean;
  onMoveToActive: () => void;
}) {
  const { state, setOpportunityStatus } = useStore();
  const reason = buildWatchlistReason(opportunity, state.nextActions);
  const pendingSignals = countPendingSignals(opportunity.id, state.aiSignals);

  return (
    <Card
      size="sm"
      className={cn(
        "ring-foreground/8 gap-2 bg-muted/20",
        highlighted && "ring-2 ring-indigo-400 bg-indigo-50/50 dark:ring-indigo-500/60 dark:bg-indigo-500/5"
      )}
    >
      <div className="flex flex-col gap-1.5 px-3">
        <div className="flex items-start justify-between gap-1">
          <Link href={`/opportunities/${opportunity.id}`} className="flex min-w-0 items-center gap-1.5">
            {state.comparisonModeActive ? (
              <ComparisonCheckbox
                opportunityId={opportunity.id}
                label={`${opportunity.role} at ${opportunity.company}`}
              />
            ) : null}
            {opportunity.isDream ? (
              <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
            ) : null}
            <span className="truncate text-sm font-medium text-foreground hover:underline">{opportunity.role}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <AiSignalGlyph opportunityId={opportunity.id} count={pendingSignals} />
            <OpportunityQuickActionsMenu opportunity={opportunity} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs text-muted-foreground">{opportunity.company}</span>
          <FitChip fit={opportunity.fit} className="shrink-0" />
        </div>
        <p className="truncate text-xs text-muted-foreground">{reason}</p>
        <div className="flex items-center gap-1.5 pt-0.5">
          <Button size="sm" variant="outline" className="h-7 flex-1 px-2 text-xs" onClick={onMoveToActive}>
            Move to Active
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Archive ${opportunity.role}`}
            onClick={() => setOpportunityStatus(opportunity.id, "Closed")}
          >
            <Archive className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function WatchlistRow({
  opportunity,
  highlighted,
  onMoveToActive,
}: {
  opportunity: Opportunity;
  highlighted: boolean;
  onMoveToActive: () => void;
}) {
  const { state, setOpportunityStatus } = useStore();
  const reason = buildWatchlistReason(opportunity, state.nextActions);
  const pendingSignals = countPendingSignals(opportunity.id, state.aiSignals);

  return (
    <TableRow className={cn(highlighted && "bg-indigo-50/50 dark:bg-indigo-500/5")}>
      <TableCell className="max-w-64 py-1.5 whitespace-normal">
        <Link href={`/opportunities/${opportunity.id}`} className="flex items-center gap-1.5 hover:underline">
          {opportunity.isDream ? (
            <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
          ) : null}
          <span className="truncate font-medium text-foreground">{opportunity.role}</span>
        </Link>
        <div className="truncate text-xs text-muted-foreground">{opportunity.company}</div>
      </TableCell>
      <TableCell className="py-1.5">
        <FitChip fit={opportunity.fit} />
      </TableCell>
      <TableCell className="max-w-80 truncate py-1.5 text-muted-foreground">{reason}</TableCell>
      <TableCell className="py-1.5 text-right">
        <AiSignalGlyph opportunityId={opportunity.id} count={pendingSignals} className="ml-auto" />
      </TableCell>
      <TableCell className="py-1.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onMoveToActive}>
            Move to Active
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Archive ${opportunity.role}`}
            onClick={() => setOpportunityStatus(opportunity.id, "Closed")}
          >
            <Archive className="size-3.5" />
          </Button>
          <OpportunityQuickActionsMenu opportunity={opportunity} />
        </div>
      </TableCell>
    </TableRow>
  );
}
