"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_COMPARISON } from "@/lib/comparison-utils";
import { useStore } from "@/lib/store";

/**
 * The one selection control compare mode adds to every board card and list
 * row. Reads and writes the store's comparisonSelection directly (no prop
 * drilling through the views), disables and explains itself once 4 are
 * already picked, and always stops the click from reaching the card's own
 * Link navigation underneath it.
 */
export function ComparisonCheckbox({ opportunityId, label }: { opportunityId: string; label: string }) {
  const { state, toggleComparisonSelection } = useStore();
  const selected = state.comparisonSelection.includes(opportunityId);
  const atMax = !selected && state.comparisonSelection.length >= MAX_COMPARISON;

  const checkbox = (
    <Checkbox
      checked={selected}
      disabled={atMax}
      aria-label={selected ? `Remove ${label} from comparison` : `Add ${label} to comparison`}
      onClick={(event) => event.stopPropagation()}
      onCheckedChange={() => toggleComparisonSelection(opportunityId)}
    />
  );

  if (!atMax) return checkbox;

  return (
    <Tooltip>
      <TooltipTrigger asChild onClick={(event) => event.stopPropagation()}>
        <span className="inline-flex">{checkbox}</span>
      </TooltipTrigger>
      <TooltipContent>Compare up to {MAX_COMPARISON} at a time</TooltipContent>
    </Tooltip>
  );
}
