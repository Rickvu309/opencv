"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { FitChip } from "@/components/shared/fit-chip";
import { PriorityChip } from "@/components/shared/priority-chip";
import { AiSignalGlyph } from "@/components/opportunities/ai-signal-glyph";
import { ComparisonCheckbox } from "@/components/opportunities/comparison-checkbox";
import { OpportunityQuickActionsMenu } from "@/components/opportunities/opportunity-quick-actions-menu";
import {
  compareOpportunities,
  countPendingSignals,
  daysBetween,
  findPrimaryNextAction,
  isStaleOpportunity,
} from "@/lib/opportunity-utils";
import { today, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NextAction, Opportunity, OpportunityStatus } from "@/lib/types";

// Active mode's board columns: the operational pipeline stages only
// (section 2). Saved holds only the Saved opportunities the caller has
// already filtered down to the Active lens (an accepted next action);
// Closed never gets its own column, it collapses into a count chip at the
// end that expands on demand instead of permanently taking board width for
// a stage nothing is actively working.
const COLUMNS: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer"];

interface OpportunityBoardViewProps {
  opportunities: Opportunity[];
  closedOpportunities: Opportunity[];
  highlightedId?: string;
}

export function OpportunityBoardView({ opportunities, closedOpportunities, highlightedId }: OpportunityBoardViewProps) {
  const { state, setOpportunitiesClosedExpanded } = useStore();
  const todayIso = today();
  const closedExpanded = state.opportunitiesClosedExpanded;

  return (
    <div className="flex flex-col gap-3">
      {/*
        Fixed-width columns in a horizontally scrolling row, not an
        equal-fraction grid: 4 pipeline-stage columns still squeeze
        illegibly at 1280px with the Copilot panel open (a hard,
        no-ellipsis clip on the priority chip), the same class of bug
        lessons.md #22/#37/#42 already named and #50 already fixed once
        for the recruiter pipeline's 6-column board. Columns carry
        positional meaning here (Saved < Applied < Interview < Offer), so
        reflowing them per viewport (Watchlist's plain card grid can do
        that safely) isn't an option, they have to stay side by side.
      */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {COLUMNS.map((status) => {
          const columnOpportunities = opportunities
            .filter((opportunity) => opportunity.status === status)
            .sort(compareOpportunities("priority"));

          return (
            <div key={status} className="flex w-64 shrink-0 flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold text-foreground">{status}</span>
                <span className="text-xs text-muted-foreground">{columnOpportunities.length}</span>
              </div>

              {columnOpportunities.length === 0 ? (
                <EmptyState
                  className="px-3 py-6"
                  message={
                    status === "Saved"
                      ? "Nothing saved is being worked yet. Move one from Watchlist to start it."
                      : `Nothing in ${status.toLowerCase()} yet.`
                  }
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {columnOpportunities.map((opportunity) => (
                    <BoardCard
                      key={opportunity.id}
                      opportunity={opportunity}
                      nextAction={findPrimaryNextAction(opportunity.id, state.nextActions)}
                      stale={isStaleOpportunity(opportunity, todayIso)}
                      staleDays={daysBetween(opportunity.lastActivityAt, todayIso)}
                      pendingSignals={countPendingSignals(opportunity.id, state.aiSignals)}
                      highlighted={opportunity.id === highlightedId}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg ring-1 ring-foreground/8">
        <button
          type="button"
          onClick={() => setOpportunitiesClosedExpanded(!closedExpanded)}
          aria-expanded={closedExpanded}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>
            Closed <span className="text-muted-foreground">({closedOpportunities.length})</span>
          </span>
          {closedExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        {closedExpanded ? (
          closedOpportunities.length === 0 ? (
            <EmptyState className="px-3 py-6" message="Nothing closed yet." />
          ) : (
            <div className="grid grid-cols-1 gap-2 border-t border-border p-2 sm:grid-cols-2 lg:grid-cols-4">
              {closedOpportunities.map((opportunity) => (
                <BoardCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  nextAction={findPrimaryNextAction(opportunity.id, state.nextActions)}
                  stale={false}
                  staleDays={0}
                  pendingSignals={countPendingSignals(opportunity.id, state.aiSignals)}
                  highlighted={opportunity.id === highlightedId}
                />
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function BoardCard({
  opportunity,
  nextAction,
  stale,
  staleDays,
  pendingSignals,
  highlighted,
}: {
  opportunity: Opportunity;
  nextAction?: NextAction;
  stale: boolean;
  staleDays: number;
  pendingSignals: number;
  highlighted: boolean;
}) {
  const { state } = useStore();

  const line3 = nextAction
    ? `${nextAction.verb}${nextAction.dueHint ? ` · ${nextAction.dueHint}` : ""}`
    : stale
      ? `No activity in ${staleDays} days`
      : "No next action suggested yet.";

  return (
    <Link href={`/opportunities/${opportunity.id}`} className="block">
      <Card
        size="sm"
        className={cn(
          "ring-foreground/8 gap-1.5 transition-colors duration-700 hover:ring-foreground/20",
          highlighted &&
            "ring-2 ring-indigo-400 bg-indigo-50/50 dark:ring-indigo-500/60 dark:bg-indigo-500/5"
        )}
      >
        <div className="flex flex-col gap-1 px-3">
          <div className="flex items-center justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {state.comparisonModeActive ? (
                <ComparisonCheckbox
                  opportunityId={opportunity.id}
                  label={`${opportunity.role} at ${opportunity.company}`}
                />
              ) : null}
              {opportunity.isDream ? (
                <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
              ) : null}
              <span className="truncate text-sm font-medium text-foreground">{opportunity.role}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <AiSignalGlyph opportunityId={opportunity.id} count={pendingSignals} />
              <OpportunityQuickActionsMenu opportunity={opportunity} />
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs text-muted-foreground">{opportunity.company}</span>
            <FitChip fit={opportunity.fit} className="shrink-0" />
            <PriorityChip priority={opportunity.priority} className="shrink-0" />
          </div>
          <p className="truncate text-xs text-muted-foreground">{line3}</p>
        </div>
      </Card>
    </Link>
  );
}
