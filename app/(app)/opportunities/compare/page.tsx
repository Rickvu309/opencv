"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { ComparisonHeaderCards } from "@/components/opportunities/compare/comparison-header-cards";
import { ComparisonRecoverState, type ComparisonRecoverReason } from "@/components/opportunities/compare/comparison-recover-state";
import { isValidComparisonSelection } from "@/lib/comparison-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; ids: string[] }
  | { status: "recover"; reason: ComparisonRecoverReason };

export default function OpportunityComparePage() {
  useCopilotSurface("Opportunities: Compare");
  const { state, setComparisonSelection } = useStore();
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

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
        </div>
      )}
    </WorkspacePage>
  );
}
