"use client";

import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, Scale, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_COMPARISON } from "@/lib/comparison-utils";
import { resolveOpportunitySurface } from "@/lib/copilot-utils";
import { useStore } from "@/lib/store";
import type { Opportunity, OpportunityStatus, Priority } from "@/lib/types";

const STATUS_OPTIONS: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];
const PRIORITY_OPTIONS: Priority[] = ["High", "Medium", "Low"];

/**
 * The one quick-actions surface shared by board cards and list rows: change
 * status, set priority, toggle Dream, open detail, and ask Copilot about
 * this specific opportunity. Doubles as the "status dropdown" the workspace
 * spec requires on every card.
 */
export function OpportunityQuickActionsMenu({ opportunity }: { opportunity: Opportunity }) {
  const {
    state,
    setOpportunityStatus,
    setOpportunityPriority,
    toggleDream,
    setCopilotSurface,
    setCopilotOpen,
    setComparisonMode,
    toggleComparisonSelection,
  } = useStore();
  const router = useRouter();

  function askCopilot() {
    setCopilotSurface(resolveOpportunitySurface(opportunity.company), `${opportunity.role} at ${opportunity.company}`);
    setCopilotOpen(true);
  }

  const inComparison = state.comparisonSelection.includes(opportunity.id);
  const comparisonFull = !inComparison && state.comparisonSelection.length >= MAX_COMPARISON;

  function addToComparison() {
    setComparisonMode(true);
    toggleComparisonSelection(opportunity.id);
    if (inComparison) return;
    const nextCount = state.comparisonSelection.length + 1;
    toast.success("Added to comparison", { description: `${nextCount} of ${MAX_COMPARISON} selected.` });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Quick actions for ${opportunity.role}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuLabel>{opportunity.role}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STATUS_OPTIONS.map((status) => (
              <DropdownMenuItem
                key={status}
                onSelect={() => setOpportunityStatus(opportunity.id, status)}
              >
                {status === opportunity.status ? <Check className="size-3.5" /> : null}
                {status}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Set priority</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {PRIORITY_OPTIONS.map((priority) => (
              <DropdownMenuItem
                key={priority}
                onSelect={() => setOpportunityPriority(opportunity.id, priority)}
              >
                {priority === opportunity.priority ? <Check className="size-3.5" /> : null}
                {priority}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onSelect={() => toggleDream(opportunity.id)}>
          <Star className={opportunity.isDream ? "size-3.5 fill-current" : "size-3.5"} />
          {opportunity.isDream ? "Remove Dream flag" : "Flag as Dream"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => router.push(`/opportunities/${opportunity.id}`)}>
          Open detail
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={askCopilot}>
          <Sparkles className="size-3.5" />
          Ask Copilot about this
        </DropdownMenuItem>
        <DropdownMenuItem disabled={comparisonFull} onSelect={addToComparison}>
          <Scale className="size-3.5" />
          {inComparison
            ? "Remove from comparison"
            : comparisonFull
              ? `Comparison full (${MAX_COMPARISON} max)`
              : "Add to comparison"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
