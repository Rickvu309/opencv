"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ChevronDown, ChevronUp, Star } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FitChip } from "@/components/shared/fit-chip";
import { PriorityChip } from "@/components/shared/priority-chip";
import { StatusChip } from "@/components/shared/status-chip";
import { AiSignalGlyph } from "@/components/opportunities/ai-signal-glyph";
import { ComparisonCheckbox } from "@/components/opportunities/comparison-checkbox";
import { OpportunityQuickActionsMenu } from "@/components/opportunities/opportunity-quick-actions-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  countPendingSignals,
  daysBetween,
  findPrimaryNextAction,
  isStaleOpportunity,
  type OpportunitySort,
} from "@/lib/opportunity-utils";
import { today, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/lib/types";

interface OpportunityListViewProps {
  opportunities: Opportunity[];
  closedOpportunities: Opportunity[];
  sort: OpportunitySort;
  onSortChange: (sort: OpportunitySort) => void;
  highlightedId?: string;
}

export function OpportunityListView({
  opportunities,
  closedOpportunities,
  sort,
  onSortChange,
  highlightedId,
}: OpportunityListViewProps) {
  const { state, setOpportunitiesClosedExpanded } = useStore();
  const router = useRouter();
  const todayIso = today();
  const closedExpanded = state.opportunitiesClosedExpanded;

  if (opportunities.length === 0 && closedOpportunities.length === 0) {
    return (
      <EmptyState message="No opportunities match this view. Adjust the filter, or add a new opportunity." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {state.comparisonModeActive ? <TableHead className="w-8" /> : null}
              <TableHead>Role and company</TableHead>
              <TableHead>Stage</TableHead>
              <SortableHead label="Fit" active={sort === "fit"} onClick={() => onSortChange("fit")} />
              <SortableHead
                label="Priority"
                active={sort === "priority"}
                onClick={() => onSortChange("priority")}
              />
              <TableHead>Next action</TableHead>
              <SortableHead
                label="Last activity"
                align="right"
                active={sort === "recently-active"}
                onClick={() => onSortChange("recently-active")}
              />
              <TableHead className="w-10 text-right">
                <span className="sr-only">Signals</span>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                  Nothing matches this view.
                </TableCell>
              </TableRow>
            ) : (
              opportunities.map((opportunity) => (
                <OpportunityRow
                  key={opportunity.id}
                  opportunity={opportunity}
                  highlighted={opportunity.id === highlightedId}
                  todayIso={todayIso}
                  showCheckbox={state.comparisonModeActive}
                  onOpen={() => router.push(`/opportunities/${opportunity.id}`)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/8">
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
        {closedExpanded && closedOpportunities.length > 0 ? (
          <Table>
            <TableBody>
              {closedOpportunities.map((opportunity) => (
                <OpportunityRow
                  key={opportunity.id}
                  opportunity={opportunity}
                  highlighted={opportunity.id === highlightedId}
                  todayIso={todayIso}
                  showCheckbox={state.comparisonModeActive}
                  onOpen={() => router.push(`/opportunities/${opportunity.id}`)}
                />
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>
    </div>
  );
}

function OpportunityRow({
  opportunity,
  highlighted,
  todayIso,
  showCheckbox,
  onOpen,
}: {
  opportunity: Opportunity;
  highlighted: boolean;
  todayIso: string;
  showCheckbox: boolean;
  onOpen: () => void;
}) {
  const { state } = useStore();
  const nextAction = findPrimaryNextAction(opportunity.id, state.nextActions);
  const stale = isStaleOpportunity(opportunity, todayIso);
  const staleDays = daysBetween(opportunity.lastActivityAt, todayIso);
  const pendingSignals = countPendingSignals(opportunity.id, state.aiSignals);

  return (
    <TableRow
      className={cn(
        "cursor-pointer",
        highlighted && "bg-indigo-50/50 dark:bg-indigo-500/5"
      )}
      onClick={onOpen}
    >
      {showCheckbox ? (
        <TableCell className="py-1.5" onClick={(event) => event.stopPropagation()}>
          <ComparisonCheckbox
            opportunityId={opportunity.id}
            label={`${opportunity.role} at ${opportunity.company}`}
          />
        </TableCell>
      ) : null}
      <TableCell className="max-w-64 py-1.5 whitespace-normal">
        <div className="flex items-center gap-1.5">
          {opportunity.isDream ? (
            <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
          ) : null}
          <span className="truncate font-medium text-foreground">{opportunity.role}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{opportunity.company}</div>
      </TableCell>
      <TableCell className="py-1.5">
        <StatusChip status={opportunity.status} />
      </TableCell>
      <TableCell className="py-1.5">
        <FitChip fit={opportunity.fit} />
      </TableCell>
      <TableCell className="py-1.5">
        <PriorityChip priority={opportunity.priority} />
      </TableCell>
      <TableCell className="max-w-56 truncate py-1.5 text-muted-foreground">
        {nextAction
          ? `${nextAction.verb}${nextAction.dueHint ? ` · ${nextAction.dueHint}` : ""}`
          : stale
            ? `No activity in ${staleDays} days`
            : "No next action suggested yet."}
      </TableCell>
      <TableCell className="py-1.5 text-right text-muted-foreground">{opportunity.lastActivityAt}</TableCell>
      <TableCell className="py-1.5 text-right" onClick={(event) => event.stopPropagation()}>
        <AiSignalGlyph opportunityId={opportunity.id} count={pendingSignals} className="ml-auto" />
      </TableCell>
      <TableCell className="py-1.5 text-right" onClick={(event) => event.stopPropagation()}>
        <OpportunityQuickActionsMenu opportunity={opportunity} />
      </TableCell>
    </TableRow>
  );
}

function SortableHead({
  label,
  active,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 font-medium",
          align === "right" && "ml-auto flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
        {active ? <ArrowDown className="size-3" /> : null}
      </button>
    </TableHead>
  );
}
