"use client";

import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, Sparkles, Star } from "lucide-react";

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
  const { setOpportunityStatus, setOpportunityPriority, toggleDream, setCopilotSurface, setCopilotOpen } =
    useStore();
  const router = useRouter();

  function askCopilot() {
    setCopilotSurface("Opportunity Detail", `${opportunity.role} at ${opportunity.company}`);
    setCopilotOpen(true);
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
