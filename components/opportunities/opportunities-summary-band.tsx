"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { OpportunityStatus } from "@/lib/types";

const PIPELINE_STATUSES: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer"];

interface OpportunitiesSummaryBandProps {
  pipelineCounts: Record<OpportunityStatus, number>;
  needsAttentionCount: number;
  watchlistCount: number;
  activeStatusFilter: OpportunityStatus | null;
  needsAttentionActive: boolean;
  watchlistActive: boolean;
  onSelectStatus: (status: OpportunityStatus) => void;
  onSelectNeedsAttention: () => void;
  onSelectWatchlist: () => void;
}

function Tile({
  value,
  label,
  ariaLabel,
  onClick,
  active,
  emphasis,
}: {
  value: number;
  label: string;
  ariaLabel: string;
  onClick: () => void;
  active?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-center transition-colors hover:bg-muted/60",
        active && "bg-muted"
      )}
    >
      <span className={cn("text-xl font-semibold tracking-tight", emphasis && value > 0 && "text-primary")}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

/**
 * The one summary above both modes (section 2): a compact count row that
 * answers "what is active now" (pipeline stage counts), "what deserves
 * attention next" (the needs-attention count, scoped to the operational
 * pipeline, see docs/lessons.md), and "what is promising but not yet
 * active" (the watchlist size) in a single glance, each count a real filter
 * rather than decoration. Chunked into two groups behind a divider
 * (Miller's Law), matching Home's own StatTiles pattern.
 */
export function OpportunitiesSummaryBand({
  pipelineCounts,
  needsAttentionCount,
  watchlistCount,
  activeStatusFilter,
  needsAttentionActive,
  watchlistActive,
  onSelectStatus,
  onSelectNeedsAttention,
  onSelectWatchlist,
}: OpportunitiesSummaryBandProps) {
  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex items-stretch gap-1">
        <Tile
          value={needsAttentionCount}
          label="Needs attention"
          ariaLabel={`Filter to needs attention, ${needsAttentionCount} opportunities`}
          onClick={onSelectNeedsAttention}
          active={needsAttentionActive}
          emphasis
        />
        <Separator orientation="vertical" className="mx-1 h-auto self-stretch" />
        {PIPELINE_STATUSES.map((status) => (
          <Tile
            key={status}
            value={pipelineCounts[status]}
            label={status}
            ariaLabel={`Filter to ${status}, ${pipelineCounts[status]} opportunities`}
            onClick={() => onSelectStatus(status)}
            active={activeStatusFilter === status}
          />
        ))}
        <Separator orientation="vertical" className="mx-1 h-auto self-stretch" />
        <Tile
          value={watchlistCount}
          label="Watchlist"
          ariaLabel={`View Watchlist, ${watchlistCount} opportunities`}
          onClick={onSelectWatchlist}
          active={watchlistActive}
        />
      </CardContent>
    </Card>
  );
}
