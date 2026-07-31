"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { SaveBackConfirmation } from "@/components/ai/save-back-confirmation";
import { ComparisonDecisionActions } from "@/components/opportunities/compare/comparison-decision-actions";
import { ComparisonDimensionGrid } from "@/components/opportunities/compare/comparison-dimension-grid";
import { ComparisonHeaderCards } from "@/components/opportunities/compare/comparison-header-cards";
import { ComparisonRecoverState, type ComparisonRecoverReason } from "@/components/opportunities/compare/comparison-recover-state";
import { ComparisonTradeoffs } from "@/components/opportunities/compare/comparison-tradeoffs";
import { ComparisonVerdicts } from "@/components/opportunities/compare/comparison-verdicts";
import { buildFocusConfirmationMessage, isValidComparisonSelection } from "@/lib/comparison-utils";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { NextActionState, Opportunity, Priority } from "@/lib/types";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; ids: string[] }
  | { status: "recover"; reason: ComparisonRecoverReason };

interface FocusResult {
  opportunityId: string;
  message: string;
  undo: {
    activityMomentId: string;
    previousPriority: Priority;
    nextActionId?: string;
    previousNextActionState?: NextActionState;
  };
}

export default function OpportunityComparePage() {
  useCopilotSurface("Opportunities: Compare");
  const { state, setComparisonSelection, focusOpportunityFromComparison, undoFocusOpportunityFromComparison } =
    useStore();
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [focusResult, setFocusResult] = useState<FocusResult | null>(null);

  // Reads `ids` straight off the URL on mount, matching the /opportunities
  // and /opportunities/[id] pages' own window.location.search / hash sync
  // convention (avoids a useSearchParams Suspense boundary, see
  // docs/lessons.md). Valid ids persist into comparisonSelection so a later
  // revisit with no ids at all can fall back to this exact comparison.
  useEffect(() => {
    function syncSelectionFromQuery() {
      const param = new URLSearchParams(window.location.search).get("ids");

      if (!param) {
        if (isValidComparisonSelection(state.comparisonSelection, state.opportunities)) {
          router.replace(`/opportunities/compare?ids=${state.comparisonSelection.join(",")}`);
          return;
        }
        setLoad({ status: "recover", reason: "empty" });
        return;
      }

      const ids = param.split(",").filter(Boolean);
      if (!isValidComparisonSelection(ids, state.opportunities)) {
        setLoad({ status: "recover", reason: "invalid" });
        return;
      }

      setComparisonSelection(ids);
      setLoad({ status: "ready", ids });
    }
    syncSelectionFromQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected =
    load.status === "ready" ? load.ids.map((id) => state.opportunities.find((o) => o.id === id)!) : [];

  // Shared by the verdict cards' primary button and the closing action
  // row's secondary one, so a decision made from either place applies the
  // exact same change and shows the exact same save-back confirmation.
  function handleFocus(opportunity: Opportunity) {
    const comparedAgainst = selected.filter((entry) => entry.id !== opportunity.id);
    const result = focusOpportunityFromComparison(opportunity, comparedAgainst);
    setFocusResult({
      opportunityId: opportunity.id,
      message: buildFocusConfirmationMessage(opportunity, result),
      undo: {
        activityMomentId: result.activityMomentId,
        previousPriority: result.previousPriority,
        nextActionId: result.nextActionId,
        previousNextActionState: result.previousNextActionState,
      },
    });
  }

  function handleUndo() {
    if (!focusResult) return;
    undoFocusOpportunityFromComparison(focusResult.opportunityId, focusResult.undo);
    setFocusResult(null);
  }

  return (
    <WorkspacePage
      title="Compare opportunities"
      description={
        load.status === "ready"
          ? "A focused read across the candidates you picked, ending in one decision."
          : undefined
      }
    >
      {load.status === "loading" ? null : load.status === "recover" ? (
        <ComparisonRecoverState reason={load.reason} />
      ) : (
        <div className="flex flex-col gap-6">
          <ComparisonHeaderCards opportunities={selected} />
          {focusResult ? (
            <SaveBackConfirmation message={focusResult.message} onUndo={handleUndo} />
          ) : null}
          <ComparisonDimensionGrid opportunities={selected} />
          <ComparisonTradeoffs opportunities={selected} />
          <ComparisonVerdicts opportunities={selected} onFocus={handleFocus} />
          <ComparisonDecisionActions opportunities={selected} onFocus={handleFocus} />
        </div>
      )}
    </WorkspacePage>
  );
}
