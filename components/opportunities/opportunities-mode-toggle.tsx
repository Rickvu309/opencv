"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { OpportunitiesMode } from "@/lib/store";

interface OpportunitiesModeToggleProps {
  mode: OpportunitiesMode;
  onModeChange: (mode: OpportunitiesMode) => void;
  activeCount: number;
  watchlistCount: number;
}

/**
 * The page-level lens switch (RDS-994): Active, the operational pipeline,
 * against Watchlist, promising but not yet active. Two modes, not five
 * (Hick's Law), built on the same ToggleGroup segmented-control pattern
 * Proof Builder's context picker already established rather than a
 * hand-rolled button pair.
 */
export function OpportunitiesModeToggle({
  mode,
  onModeChange,
  activeCount,
  watchlistCount,
}: OpportunitiesModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={mode}
      onValueChange={(value) => value && onModeChange(value as OpportunitiesMode)}
      aria-label="Opportunities view mode"
    >
      <ToggleGroupItem value="active">Active ({activeCount})</ToggleGroupItem>
      <ToggleGroupItem value="watchlist">Watchlist ({watchlistCount})</ToggleGroupItem>
    </ToggleGroup>
  );
}
