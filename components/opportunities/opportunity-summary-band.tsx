"use client";

import Link from "next/link";
import { Check, ChevronLeft, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { CredibilityChip } from "@/components/shared/credibility-chip";
import { FitChip } from "@/components/shared/fit-chip";
import { PriorityChip } from "@/components/shared/priority-chip";
import { StatusChip } from "@/components/shared/status-chip";
import { useStore } from "@/lib/store";
import type { NextAction, NextActionState, Opportunity, OpportunityStatus, Priority } from "@/lib/types";

const STATUS_OPTIONS: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];
const PRIORITY_OPTIONS: Priority[] = ["High", "Medium", "Low"];

const NEXT_ACTION_STATE_LABEL: Record<NextActionState, string> = {
  suggested: "Recommended",
  accepted: "In plan",
  done: "Done",
  dismissed: "Dismissed",
};

interface OpportunitySummaryBandProps {
  opportunity: Opportunity;
  primaryNextAction?: NextAction;
}

/**
 * The band that stays visible above the tabs: breadcrumb back link, role and
 * company header, and the chip row with inline status and priority change,
 * the Dream toggle, the read-only fit judgment, and the current next action
 * as a compact pill.
 */
export function OpportunitySummaryBand({ opportunity, primaryNextAction }: OpportunitySummaryBandProps) {
  const { setOpportunityStatus, setOpportunityPriority, toggleDream } = useStore();

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/opportunities"
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        Opportunities
      </Link>

      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="break-words">{opportunity.role}</h1>
        <p className="break-words text-sm text-muted-foreground">
          {opportunity.company} · {opportunity.location} · {opportunity.salaryRange} · Source: {opportunity.source}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <StatusChip status={opportunity.status} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUS_OPTIONS.map((status) => (
              <DropdownMenuItem key={status} onSelect={() => setOpportunityStatus(opportunity.id, status)}>
                {status === opportunity.status ? <Check className="size-3.5" /> : null}
                {status}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <PriorityChip priority={opportunity.priority} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {PRIORITY_OPTIONS.map((priority) => (
              <DropdownMenuItem key={priority} onSelect={() => setOpportunityPriority(opportunity.id, priority)}>
                {priority === opportunity.priority ? <Check className="size-3.5" /> : null}
                {priority}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <FitChip fit={opportunity.fit} />

        <Button
          size="sm"
          variant={opportunity.isDream ? "secondary" : "outline"}
          onClick={() => toggleDream(opportunity.id)}
        >
          <Star className={opportunity.isDream ? "size-3.5 fill-current" : "size-3.5"} />
          {opportunity.isDream ? "Dream" : "Flag as Dream"}
        </Button>

        {opportunity.hasCredibilityFlag ? (
          <CredibilityChip verdict="fail" label="Credibility flag" />
        ) : null}

        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
          <span className="font-medium text-foreground">
            {primaryNextAction ? primaryNextAction.verb : "No next action suggested yet"}
          </span>
          {primaryNextAction ? (
            <span className="text-muted-foreground">· {NEXT_ACTION_STATE_LABEL[primaryNextAction.state]}</span>
          ) : null}
        </span>
        {primaryNextAction ? <ConfidenceChip confidence={primaryNextAction.confidence} /> : null}
      </div>
    </div>
  );
}
