"use client";

import { Info } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FitChip } from "@/components/shared/fit-chip";
import { ComparisonJudgmentChip } from "@/components/opportunities/compare/comparison-judgment-chip";
import {
  COMPARISON_DIMENSIONS,
  comparisonGridTemplate,
  getComparisonProfile,
  goalAlignmentLabel,
  type ComparisonDimensionId,
} from "@/lib/comparison-utils";
import { useStore } from "@/lib/store";
import type { FitInsight, Opportunity } from "@/lib/types";

/**
 * The comparison grid itself: rows are dimensions in priority order, columns
 * are candidates (Proximity: every one of a candidate's signals lives in
 * its own column). Cells stay compact, one chip each, never prose; each
 * row's own info affordance holds the "how this is judged" methodology
 * behind a click (Progressive Disclosure), so the default read is scan-only.
 */
export function ComparisonDimensionGrid({ opportunities }: { opportunities: Opportunity[] }) {
  const gridTemplateColumns = comparisonGridTemplate(opportunities.length);

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      {COMPARISON_DIMENSIONS.map((dimension) => (
        <div
          key={dimension.id}
          className="grid items-center gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0"
          style={{ gridTemplateColumns }}
        >
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-foreground">{dimension.label}</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`How ${dimension.label} is judged`}
                  className="rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-64">
                <p className="text-xs text-muted-foreground">{dimension.methodology}</p>
              </PopoverContent>
            </Popover>
          </div>

          {opportunities.map((opportunity) => (
            <div key={opportunity.id} className="min-w-0">
              <DimensionCell dimensionId={dimension.id} opportunity={opportunity} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DimensionCell({
  dimensionId,
  opportunity,
}: {
  dimensionId: ComparisonDimensionId;
  opportunity: Opportunity;
}) {
  const { state } = useStore();

  if (dimensionId === "fit") {
    const fitInsight = state.insights.find(
      (insight): insight is FitInsight => insight.kind === "fit" && insight.hostId === opportunity.id
    );
    return <FitChip fit={fitInsight?.level ?? opportunity.fit} />;
  }

  if (dimensionId === "goal-alignment") {
    const { tone, label } = goalAlignmentLabel(opportunity, state.goals);
    return <ComparisonJudgmentChip tone={tone} label={label} />;
  }

  const profile = getComparisonProfile(opportunity.id, state.comparisonProfiles);
  if (!profile) return <ComparisonJudgmentChip tone="muted" label="Not yet judged" />;

  const key =
    dimensionId === "growth-potential"
      ? "growthPotential"
      : dimensionId === "timing"
        ? "timing"
        : dimensionId === "risk"
          ? "risk"
          : "preparationEffort";
  const judgment = profile[key];
  return <ComparisonJudgmentChip tone={judgment.tone} label={judgment.label} />;
}
