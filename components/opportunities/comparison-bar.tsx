"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_COMPARISON, MIN_COMPARISON } from "@/lib/comparison-utils";
import { useStore } from "@/lib/store";

/**
 * The floating bar compare mode shows once at least one card is checked:
 * the running count against the 4-candidate cap, the launch action, and a
 * way out of selection mode. Fixed and centered rather than inline so it
 * stays reachable while the board or list scrolls underneath it.
 */
export function ComparisonBar() {
  const { state, setComparisonMode } = useStore();
  const router = useRouter();
  const count = state.comparisonSelection.length;

  if (!state.comparisonModeActive) return null;

  const canCompare = count >= MIN_COMPARISON && count <= MAX_COMPARISON;

  function exitSelection() {
    setComparisonMode(false);
  }

  function launchCompare() {
    setComparisonMode(false);
    router.push(`/opportunities/compare?ids=${state.comparisonSelection.join(",")}`);
  }

  const compareButton = (
    <Button size="sm" disabled={!canCompare} onClick={launchCompare}>
      Compare {count} of {MAX_COMPARISON} max
    </Button>
  );

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center">
      <div className="flex items-center gap-3 rounded-full bg-popover px-4 py-2 ring-1 ring-foreground/10 backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {count === 0 ? "Select 2 to 4 opportunities to compare" : `${count} of ${MAX_COMPARISON} selected`}
        </span>
        {canCompare ? (
          compareButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{compareButton}</span>
            </TooltipTrigger>
            <TooltipContent>Select at least {MIN_COMPARISON} to compare</TooltipContent>
          </Tooltip>
        )}
        <Button size="icon-sm" variant="ghost" aria-label="Exit compare selection" onClick={exitSelection}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
