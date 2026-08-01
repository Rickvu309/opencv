"use client";

import { useEffect, useMemo } from "react";
import { LayoutGrid, Plus, Rows3, Scale, X } from "lucide-react";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { ComparisonBar } from "@/components/opportunities/comparison-bar";
import { OpportunitiesFocusStrip } from "@/components/opportunities/opportunities-focus-strip";
import { OpportunitiesControls } from "@/components/opportunities/opportunities-controls";
import { OpportunitiesModeToggle } from "@/components/opportunities/opportunities-mode-toggle";
import { OpportunitiesSummaryBand } from "@/components/opportunities/opportunities-summary-band";
import { OpportunityBoardView } from "@/components/opportunities/opportunity-board-view";
import { OpportunityListView } from "@/components/opportunities/opportunity-list-view";
import { WatchlistView } from "@/components/opportunities/watchlist-view";
import { Button } from "@/components/ui/button";
import {
  OPPORTUNITY_FILTER_VALUES,
  compareOpportunities,
  isActiveOpportunity,
  isWatchlistOpportunity,
  matchesFilter,
  needsAttention,
} from "@/lib/opportunity-utils";
import type { OpportunityFilter, OpportunitySort } from "@/lib/opportunity-utils";
import { today, useCopilotSurface, useStore } from "@/lib/store";
import type { OpportunityStatus } from "@/lib/types";

const STATUS_VALUES: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];
const PIPELINE_STATUSES: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer"];

export default function OpportunitiesPage() {
  useCopilotSurface("Opportunities");
  const {
    state,
    setOpportunitiesView,
    setOpportunitiesMode,
    setOpportunitiesFilter,
    setOpportunitiesSort,
    setOpportunitiesStatusFilter,
    setOpportunitiesClosedExpanded,
    clearOpportunityHighlight,
    setComparisonMode,
  } = useStore();

  const { mode, filter, sort, statusFilter } = {
    mode: state.opportunitiesMode,
    filter: state.opportunitiesFilter,
    sort: state.opportunitiesSort,
    statusFilter: state.opportunitiesStatusFilter,
  };

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
  // useSearchParams, so this page never needs a Suspense boundary. Every
  // status is an Active-lens concept (Applied/Interview/Offer always are;
  // Saved and Closed narrow to whichever slice of Saved/Closed the Active
  // lens actually shows), so this always lands in Active mode.
  useEffect(() => {
    function syncStatusFromQuery() {
      const status = new URLSearchParams(window.location.search).get("status");
      if (status && STATUS_VALUES.includes(status as OpportunityStatus)) {
        setOpportunitiesMode("active");
        setOpportunitiesStatusFilter(status as OpportunityStatus);
        if (status === "Closed") setOpportunitiesClosedExpanded(true);
      }
    }
    syncStatusFromQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Strategy surface's segment strip deep-links here with a `filter`
  // query param, for example /opportunities?filter=low-fit-effort, the same
  // URL-sync convention as the `status` param above. Strategy's own
  // segments (lib/strategy-utils.ts's buildStrategySegments) can include
  // both Active and Watchlist opportunities, this always lands in Active,
  // the empty state below points at Watchlist when a filter comes up empty
  // there instead.
  useEffect(() => {
    function syncFilterFromQuery() {
      const param = new URLSearchParams(window.location.search).get("filter");
      if (param && OPPORTUNITY_FILTER_VALUES.includes(param as OpportunityFilter)) {
        setOpportunitiesMode("active");
        setOpportunitiesFilter(param as OpportunityFilter);
      }
    }
    syncFilterFromQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const activeCohort = useMemo(
    () => state.opportunities.filter((opportunity) => isActiveOpportunity(opportunity, state.nextActions)),
    [state.opportunities, state.nextActions]
  );
  const watchlistCohort = useMemo(
    () => state.opportunities.filter((opportunity) => isWatchlistOpportunity(opportunity, state.nextActions)),
    [state.opportunities, state.nextActions]
  );
  const closedCohort = useMemo(
    () => state.opportunities.filter((opportunity) => opportunity.status === "Closed"),
    [state.opportunities]
  );

  const filteredActive = useMemo(
    () =>
      activeCohort.filter(
        (opportunity) =>
          matchesFilter(opportunity, filter, state.nextActions, todayIso) &&
          (!statusFilter || opportunity.status === statusFilter)
      ),
    [activeCohort, state.nextActions, filter, todayIso, statusFilter]
  );
  const sortedActiveForList = useMemo(
    () => [...filteredActive].sort(compareOpportunities(sort)),
    [filteredActive, sort]
  );
  const filteredClosed = useMemo(
    () => closedCohort.filter((opportunity) => matchesFilter(opportunity, filter, state.nextActions, todayIso)),
    [closedCohort, state.nextActions, filter, todayIso]
  );
  const sortedClosedForList = useMemo(
    () => [...filteredClosed].sort(compareOpportunities(sort)),
    [filteredClosed, sort]
  );

  const sortedWatchlist = useMemo(
    () => [...watchlistCohort].sort(compareOpportunities("recently-active")),
    [watchlistCohort]
  );

  const pipelineCounts = useMemo(() => {
    const counts = {} as Record<OpportunityStatus, number>;
    for (const status of PIPELINE_STATUSES) {
      counts[status] = activeCohort.filter((opportunity) => opportunity.status === status).length;
    }
    return counts;
  }, [activeCohort]);

  const needsAttentionCount = useMemo(
    () => activeCohort.filter((opportunity) => needsAttention(opportunity, state.nextActions, todayIso)).length,
    [activeCohort, state.nextActions, todayIso]
  );

  const hasNarrowedActiveToNothing =
    mode === "active" && filteredActive.length === 0 && (filter !== "all" || statusFilter !== null);

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
        <OpportunitiesModeToggle
          mode={mode}
          onModeChange={setOpportunitiesMode}
          activeCount={activeCohort.length}
          watchlistCount={watchlistCohort.length}
        />

        <OpportunitiesSummaryBand
          pipelineCounts={pipelineCounts}
          needsAttentionCount={needsAttentionCount}
          watchlistCount={watchlistCohort.length}
          activeStatusFilter={mode === "active" ? statusFilter : null}
          needsAttentionActive={mode === "active" && filter === "needs-attention"}
          watchlistActive={mode === "watchlist"}
          onSelectStatus={(status) => {
            setOpportunitiesMode("active");
            setOpportunitiesFilter("all");
            setOpportunitiesStatusFilter(status);
          }}
          onSelectNeedsAttention={() => {
            setOpportunitiesMode("active");
            setOpportunitiesFilter("needs-attention");
            setOpportunitiesStatusFilter(null);
          }}
          onSelectWatchlist={() => setOpportunitiesMode("watchlist")}
        />

        <OpportunitiesFocusStrip />

        {mode === "active" ? (
          <>
            {statusFilter ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  Status: {statusFilter}
                  <button
                    type="button"
                    aria-label="Clear status filter"
                    onClick={() => setOpportunitiesStatusFilter(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              </div>
            ) : null}

            <OpportunitiesControls
              filter={filter}
              onFilterChange={(nextFilter: OpportunityFilter) => setOpportunitiesFilter(nextFilter)}
              resultCount={filteredActive.length}
              totalCount={activeCohort.length}
              view={state.opportunitiesView}
              sort={sort}
              onSortChange={(nextSort: OpportunitySort) => setOpportunitiesSort(nextSort)}
            />

            {hasNarrowedActiveToNothing ? (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span>Nothing in Active matches this filter.</span>
                {watchlistCohort.length > 0 ? (
                  <button
                    type="button"
                    className="font-medium text-foreground hover:underline"
                    onClick={() => setOpportunitiesMode("watchlist")}
                  >
                    Check Watchlist ({watchlistCohort.length})
                  </button>
                ) : null}
              </div>
            ) : null}

            {state.opportunitiesView === "board" ? (
              <OpportunityBoardView
                opportunities={filteredActive}
                closedOpportunities={sortedClosedForList}
                highlightedId={highlightedId}
              />
            ) : (
              <OpportunityListView
                opportunities={sortedActiveForList}
                closedOpportunities={sortedClosedForList}
                sort={sort}
                onSortChange={(nextSort: OpportunitySort) => setOpportunitiesSort(nextSort)}
                highlightedId={highlightedId}
              />
            )}
          </>
        ) : (
          <WatchlistView opportunities={sortedWatchlist} view={state.opportunitiesView} highlightedId={highlightedId} />
        )}
      </div>
      <ComparisonBar />
    </WorkspacePage>
  );
}
