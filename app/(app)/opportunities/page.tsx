"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, Rows3, Scale, X } from "lucide-react";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { ComparisonBar } from "@/components/opportunities/comparison-bar";
import { OpportunitiesFocusStrip } from "@/components/opportunities/opportunities-focus-strip";
import { OpportunitiesControls } from "@/components/opportunities/opportunities-controls";
import { OpportunityBoardView } from "@/components/opportunities/opportunity-board-view";
import { OpportunityListView } from "@/components/opportunities/opportunity-list-view";
import { Button } from "@/components/ui/button";
import { compareOpportunities, matchesFilter } from "@/lib/opportunity-utils";
import type { OpportunityFilter, OpportunitySort } from "@/lib/opportunity-utils";
import { today, useCopilotSurface, useStore } from "@/lib/store";
import type { OpportunityStatus } from "@/lib/types";

const STATUS_VALUES: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];

export default function OpportunitiesPage() {
  useCopilotSurface("Opportunities");
  const { state, setOpportunitiesView, clearOpportunityHighlight, setComparisonMode } = useStore();

  const [filter, setFilter] = useState<OpportunityFilter>("all");
  const [sort, setSort] = useState<OpportunitySort>("recently-active");
  const [statusFilter, setStatusFilter] = useState<OpportunityStatus | null>(null);

  const highlightedId = state.highlightedOpportunityId;
  const todayIso = today();

  useEffect(() => {
    if (!highlightedId) return;
    const timeout = setTimeout(() => clearOpportunityHighlight(highlightedId), 2500);
    return () => clearTimeout(timeout);
  }, [highlightedId, clearOpportunityHighlight]);

  // Home's pipeline snapshot deep-links here with a `status` query param, for
  // example /opportunities?status=Interview. Read directly off the URL
  // (matching the opportunity detail page's hash-sync pattern) rather than
  // useSearchParams, so this page never needs a Suspense boundary.
  useEffect(() => {
    function syncStatusFromQuery() {
      const status = new URLSearchParams(window.location.search).get("status");
      if (status && STATUS_VALUES.includes(status as OpportunityStatus)) {
        setStatusFilter(status as OpportunityStatus);
      }
    }
    syncStatusFromQuery();
  }, []);

  // The compare workspace's "Change selection" and its recover state's "Back
  // to Opportunities" both deep-link here with ?compare=1 so returning lands
  // straight back in selection mode rather than a plain workspace view.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("compare") === "1") {
      setComparisonMode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      state.opportunities.filter(
        (opportunity) =>
          matchesFilter(opportunity, filter, state.nextActions, todayIso) &&
          (!statusFilter || opportunity.status === statusFilter)
      ),
    [state.opportunities, state.nextActions, filter, todayIso, statusFilter]
  );

  const sortedForList = useMemo(
    () => [...filtered].sort(compareOpportunities(sort)),
    [filtered, sort]
  );

  return (
    <WorkspacePage
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
          <Button
            size="sm"
            variant={state.comparisonModeActive ? "secondary" : "outline"}
            aria-pressed={state.comparisonModeActive}
            onClick={() => setComparisonMode(!state.comparisonModeActive)}
          >
            <Scale className="size-4" />
            Compare
          </Button>
          <AddOpportunityDialog>
            <Button size="sm">
              <Plus className="size-4" />
              Add opportunity
            </Button>
          </AddOpportunityDialog>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <OpportunitiesFocusStrip />

        {statusFilter ? (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              Status: {statusFilter}
              <button
                type="button"
                aria-label="Clear status filter"
                onClick={() => setStatusFilter(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          </div>
        ) : null}

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
      <ComparisonBar />
    </WorkspacePage>
  );
}
