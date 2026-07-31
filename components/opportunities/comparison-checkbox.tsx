"use client";

import type { MouseEvent } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_COMPARISON } from "@/lib/comparison-utils";
import { useStore } from "@/lib/store";

/**
 * The one selection control compare mode adds to every board card and list
 * row. Reads and writes the store's comparisonSelection directly (no prop
 * drilling through the views), disables and explains itself once 4 are
 * already picked, and always stops the click from reaching the card's own
 * Link navigation underneath it. The board card wraps this in a real
 * anchor (Next's Link), so stopPropagation alone isn't enough: the
 * browser's own anchor activation behavior still fires on a nested-element
 * click unless the event's default is also prevented. Toggling happens
 * directly from onClick rather than Radix's own onCheckedChange, because
 * preventDefault() on the click also tells Radix's composed handler to
 * skip its internal toggle (it treats a prevented click as "already
 * handled"); this component is fully controlled by comparisonSelection
 * anyway, so Radix's own internal checked state was never the source of
 * truth.
 */
export function ComparisonCheckbox({ opportunityId, label }: { opportunityId: string; label: string }) {
  const { state, toggleComparisonSelection } = useStore();
  const selected = state.comparisonSelection.includes(opportunityId);
  const atMax = !selected && state.comparisonSelection.length >= MAX_COMPARISON;

  function handleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (atMax) return;
    toggleComparisonSelection(opportunityId);
  }

  const checkbox = (
    <Checkbox
      checked={selected}
      disabled={atMax}
      aria-label={selected ? `Remove ${label} from comparison` : `Add ${label} to comparison`}
      onClick={handleClick}
    />
  );

  if (!atMax) return checkbox;

  return (
    <Tooltip>
      <TooltipTrigger asChild onClick={handleClick}>
        <span className="inline-flex">{checkbox}</span>
      </TooltipTrigger>
      <TooltipContent>Compare up to {MAX_COMPARISON} at a time</TooltipContent>
    </Tooltip>
  );
}
