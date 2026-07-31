"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, Rows3 } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { OpportunitiesFocusStrip } from "@/components/opportunities/opportunities-focus-strip";
import { OpportunitiesControls } from "@/components/opportunities/opportunities-controls";
import { OpportunityBoardView } from "@/components/opportunities/opportunity-board-view";
import { OpportunityListView } from "@/components/opportunities/opportunity-list-view";
import { Button } from "@/components/ui/button";
import { compareOpportunities, matchesFilter } from "@/lib/opportunity-utils";
import type { OpportunityFilter, OpportunitySort } from "@/lib/opportunity-utils";
import { today, useCopilotSurface, useStore } from "@/lib/store";

export default function OpportunitiesPage() {
  useCopilotSurface("Opportunities");
  const { state, setOpportunitiesView, clearOpportunityHighlight } = useStore();

  const [filter, setFilter] = useState<OpportunityFilter>("all");
  const [sort, setSort] = useState<OpportunitySort>("recently-active");

  const highlightedId = state.highlightedOpportunityId;
  const todayIso = today();

  useEffect(() => {
    if (!highlightedId) return;
    const timeout = setTimeout(() => clearOpportunityHighlight(highlightedId), 2500);
    return () => clearTimeout(timeout);
  }, [highlightedId, clearOpportunityHighlight]);

  const filtered = useMemo(
    () =>
      state.opportunities.filter((opportunity) =>
        matchesFilter(opportunity, filter, state.nextActions, todayIso)
      ),
    [state.opportunities, state.nextActions, filter, todayIso]
  );

  const sortedForList = useMemo(
    () => [...filtered].sort(compareOpportunities(sort)),
    [filtered, sort]
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Opportunities"
        description={`${state.opportunities.length} tracked, across every stage from saved to closed.`}
        primaryAction={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              <Button
                size="sm"
                variant={state.opportunitiesView === "board" ? "secondary" : "ghost"}
                aria-pressed={state.opportunitiesView === "board"}
                onClick={() => setOpportunitiesView("board")}
              >
                <LayoutGrid className="size-4" />
                Board
              </Button>
              <Button
                size="sm"
                variant={state.opportunitiesView === "list" ? "secondary" : "ghost"}
                aria-pressed={state.opportunitiesView === "list"}
                onClick={() => setOpportunitiesView("list")}
              >
                <Rows3 className="size-4" />
                List
              </Button>
            </div>
            <AddOpportunityDialog>
              <Button size="sm">
                <Plus className="size-4" />
                Add opportunity
              </Button>
            </AddOpportunityDialog>
          </div>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <OpportunitiesFocusStrip />

        <OpportunitiesControls
          filter={filter}
          onFilterChange={setFilter}
          resultCount={filtered.length}
          totalCount={state.opportunities.length}
          view={state.opportunitiesView}
          sort={sort}
          onSortChange={setSort}
        />

        {state.opportunitiesView === "board" ? (
          <OpportunityBoardView opportunities={filtered} highlightedId={highlightedId} />
        ) : (
          <OpportunityListView
            opportunities={sortedForList}
            sort={sort}
            onSortChange={setSort}
            highlightedId={highlightedId}
          />
        )}
      </div>
    </div>
  );
}
