"use client";

import { OpportunitiesModeToggle } from "@/components/opportunities/opportunities-mode-toggle";
import { OpportunityBoardView } from "@/components/opportunities/opportunity-board-view";
import { useStore } from "@/lib/store";

const SHOWCASE_IDS = ["opp-1", "opp-4", "opp-6"];

/**
 * Signature workflow 1: the Active/Watchlist lens (docs/architecture.md
 * section 11). A curated 3-opportunity slice of the real, live
 * opportunities (Saved-and-Dream, Applied, Interview) inside the real
 * board columns and the real mode toggle, so the lens itself is the thing
 * on display, not a bigger board than the frame needs.
 */
export function OpportunityWorkspaceShowcase() {
  const { state } = useStore();
  const showcaseOpportunities = SHOWCASE_IDS.map((id) => state.opportunities.find((o) => o.id === id)).filter(
    (o): o is NonNullable<typeof o> => Boolean(o)
  );

  return (
    <div className="flex w-[900px] flex-col gap-3 p-5">
      <OpportunitiesModeToggle mode="active" onModeChange={() => {}} activeCount={6} watchlistCount={4} />
      <OpportunityBoardView opportunities={showcaseOpportunities} closedOpportunities={[]} />
    </div>
  );
}
