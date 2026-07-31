"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, Star } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { FitChip } from "@/components/shared/fit-chip";
import { PriorityChip } from "@/components/shared/priority-chip";
import { StatusChip } from "@/components/shared/status-chip";
import { AttentionDot } from "@/components/opportunities/attention-dot";
import { OpportunityQuickActionsMenu } from "@/components/opportunities/opportunity-quick-actions-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
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
  sort: OpportunitySort;
  onSortChange: (sort: OpportunitySort) => void;
  highlightedId?: string;
}

export function OpportunityListView({
  opportunities,
  sort,
  onSortChange,
  highlightedId,
}: OpportunityListViewProps) {
  const { state } = useStore();
  const router = useRouter();
  const todayIso = today();

  if (opportunities.length === 0) {
    return (
      <EmptyState message="No opportunities match this view. Adjust the filter, or add a new opportunity." />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Role and company</TableHead>
            <TableHead>Status</TableHead>
            <SortableHead label="Fit" active={sort === "fit"} onClick={() => onSortChange("fit")} />
            <SortableHead
              label="Priority"
              active={sort === "priority"}
              onClick={() => onSortChange("priority")}
            />
            <TableHead>Next action</TableHead>
            <SortableHead
              label="Last activity"
              active={sort === "recently-active"}
              onClick={() => onSortChange("recently-active")}
            />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((opportunity) => {
            const nextAction = findPrimaryNextAction(opportunity.id, state.nextActions);
            const stale = isStaleOpportunity(opportunity, todayIso);
            const staleDays = daysBetween(opportunity.lastActivityAt, todayIso);

            return (
              <TableRow
                key={opportunity.id}
                className={cn(
                  "cursor-pointer",
                  opportunity.id === highlightedId && "bg-indigo-50/50 dark:bg-indigo-500/5"
                )}
                onClick={() => router.push(`/opportunities/${opportunity.id}`)}
              >
                <TableCell className="max-w-64 whitespace-normal">
                  <div className="flex items-center gap-1.5">
                    {opportunity.isDream ? (
                      <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" />
                    ) : null}
                    <span className="truncate font-medium text-foreground">{opportunity.role}</span>
                    {stale ? <AttentionDot reason={`No activity in ${staleDays} days`} /> : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{opportunity.company}</div>
                </TableCell>
                <TableCell>
                  <StatusChip status={opportunity.status} />
                </TableCell>
                <TableCell>
                  <FitChip fit={opportunity.fit} />
                </TableCell>
                <TableCell>
                  <PriorityChip priority={opportunity.priority} />
                </TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {nextAction ? nextAction.verb : "No next action suggested yet."}
                </TableCell>
                <TableCell className="text-muted-foreground">{opportunity.lastActivityAt}</TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                  <OpportunityQuickActionsMenu opportunity={opportunity} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SortableHead({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 font-medium",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
        {active ? <ArrowDown className="size-3" /> : null}
      </button>
    </TableHead>
  );
}
