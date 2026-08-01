"use client";

import { useState } from "react";
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
import { MoveToActiveDialog } from "@/components/opportunities/move-to-active-dialog";
import { MoveToWatchlistDialog } from "@/components/opportunities/move-to-watchlist-dialog";
import { MAX_COMPARISON } from "@/lib/comparison-utils";
import { resolveOpportunitySurface } from "@/lib/copilot-utils";
import { isActiveOpportunity } from "@/lib/opportunity-utils";
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
  const [modeDialog, setModeDialog] = useState<"to-active" | "to-watchlist" | null>(null);

  // Move Active/Watchlist only makes sense on a Saved opportunity: Applied,
  // Interview, and Offer are always Active by status, and Closed sits
  // outside both lenses entirely (see lib/opportunity-utils.ts). Which
  // direction the menu offers depends on whether this Saved item already
  // has an accepted next action, the same "being worked" bar the lens
  // itself checks.
  const inActiveLens = isActiveOpportunity(opportunity, state.nextActions);
  const showModeAction = opportunity.status === "Saved";

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
    <>
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

          {showModeAction ? (
            <DropdownMenuItem onSelect={() => setModeDialog(inActiveLens ? "to-watchlist" : "to-active")}>
              {inActiveLens ? "Move to Watchlist" : "Move to Active"}
            </DropdownMenuItem>
          ) : null}

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
      <MoveToActiveDialog
        opportunity={modeDialog === "to-active" ? opportunity : null}
        onClose={() => setModeDialog(null)}
      />
      <MoveToWatchlistDialog
        opportunity={modeDialog === "to-watchlist" ? opportunity : null}
        onClose={() => setModeDialog(null)}
      />
    </>
  );
}
