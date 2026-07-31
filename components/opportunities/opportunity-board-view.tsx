"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { FitChip } from "@/components/shared/fit-chip";
import { PriorityChip } from "@/components/shared/priority-chip";
import { AttentionDot } from "@/components/opportunities/attention-dot";
import { ComparisonCheckbox } from "@/components/opportunities/comparison-checkbox";
import { OpportunityQuickActionsMenu } from "@/components/opportunities/opportunity-quick-actions-menu";
import {
  compareOpportunities,
  daysBetween,
  findPrimaryNextAction,
  isStaleOpportunity,
} from "@/lib/opportunity-utils";
import { today, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NextAction, Opportunity, OpportunityStatus } from "@/lib/types";

const COLUMNS: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];

interface OpportunityBoardViewProps {
  opportunities: Opportunity[];
  highlightedId?: string;
}

export function OpportunityBoardView({ opportunities, highlightedId }: OpportunityBoardViewProps) {
  const { state } = useStore();
  const todayIso = today();

  return (
    <div className="grid grid-cols-5 gap-3">
      {COLUMNS.map((status) => {
        const columnOpportunities = opportunities
          .filter((opportunity) => opportunity.status === status)
          .sort(compareOpportunities("priority"));

        return (
          <div key={status} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-foreground">{status}</span>
              <span className="text-xs text-muted-foreground">{columnOpportunities.length}</span>
            </div>

            {columnOpportunities.length === 0 ? (
              <EmptyState
                className="px-3 py-6"
                message={
                  status === "Saved"
                    ? "No opportunities saved right now."
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
                    highlighted={opportunity.id === highlightedId}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BoardCard({
  opportunity,
  nextAction,
  stale,
  staleDays,
  highlighted,
}: {
  opportunity: Opportunity;
  nextAction?: NextAction;
  stale: boolean;
  staleDays: number;
  highlighted: boolean;
}) {
  const { state } = useStore();

  return (
    <Link href={`/opportunities/${opportunity.id}`} className="block">
      <Card
        size="sm"
        className={cn(
          "ring-foreground/8 gap-2 transition-colors duration-700 hover:ring-foreground/20",
          highlighted &&
            "ring-2 ring-indigo-400 bg-indigo-50/50 dark:ring-indigo-500/60 dark:bg-indigo-500/5"
        )}
      >
        <div className="flex flex-col gap-1.5 px-3">
          <div className="flex items-start justify-between gap-1">
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
              {stale ? (
                <AttentionDot reason={`No activity in ${staleDays} days`} />
              ) : null}
            </div>
            <OpportunityQuickActionsMenu opportunity={opportunity} />
          </div>
          <span className="truncate text-xs text-muted-foreground">{opportunity.company}</span>
          <div className="flex flex-wrap items-center gap-1">
            <FitChip fit={opportunity.fit} />
            <PriorityChip priority={opportunity.priority} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {nextAction ? nextAction.verb : "No next action suggested yet."}
          </p>
        </div>
      </Card>
    </Link>
  );
}
