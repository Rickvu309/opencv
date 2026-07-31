"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OpportunityFilter, OpportunitySort } from "@/lib/opportunity-utils";
import type { OpportunitiesView } from "@/lib/store";

const FILTER_OPTIONS: { value: OpportunityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs-attention", label: "Needs attention" },
  { value: "strong-fit", label: "Strong fit" },
  { value: "dream", label: "Dream" },
];

const SORT_OPTIONS: { value: OpportunitySort; label: string }[] = [
  { value: "fit", label: "Fit" },
  { value: "priority", label: "Priority" },
  { value: "recently-active", label: "Recently active" },
];

interface OpportunitiesControlsProps {
  filter: OpportunityFilter;
  onFilterChange: (filter: OpportunityFilter) => void;
  resultCount: number;
  totalCount: number;
  view: OpportunitiesView;
  sort: OpportunitySort;
  onSortChange: (sort: OpportunitySort) => void;
}

/**
 * One light control row shared by both views: filter chips, a list-only
 * sort select, and a result count. Never grows beyond a single row.
 */
export function OpportunitiesControls({
  filter,
  onFilterChange,
  resultCount,
  totalCount,
  view,
  sort,
  onSortChange,
}: OpportunitiesControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={filter === option.value ? "secondary" : "outline"}
            aria-pressed={filter === option.value}
            onClick={() => onFilterChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {resultCount} of {totalCount} opportunities
        </span>
        {view === "list" ? (
          <Select value={sort} onValueChange={(value) => onSortChange(value as OpportunitySort)}>
            <SelectTrigger size="sm" aria-label="Sort opportunities">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  Sort: {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  );
}
