"use client";

import { useEffect, useMemo, useState } from "react";

import { WorkspacePage } from "@/components/shell/workspace-page";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { ProofContextPicker } from "@/components/proof/proof-context-picker";
import { ProofEvidenceLayer } from "@/components/proof/proof-evidence-layer";
import { ProofClaimVerification } from "@/components/proof/proof-claim-verification";
import { ProofTransformationCard } from "@/components/proof/proof-transformation-card";
import { ProofSessionSummary } from "@/components/proof/proof-session-summary";
import {
  buildClaimsForContext,
  describeProofTarget,
  rankEvidenceForContext,
  verifyClaims,
} from "@/lib/proof-utils";
import { getWorkingPathScenario } from "@/lib/planner-utils";
import { useCopilotSurface, useStore } from "@/lib/store";
import type { ProofContext, TrackRecordEntry } from "@/lib/types";

const TRACK_RECORD_HIGHLIGHT_DURATION_MS = 2500;

export default function ProofPage() {
  useCopilotSurface("Proof Builder");
  const {
    state,
    acceptProofTransformation,
    skipProofTransformation,
    unskipProofTransformation,
    undoProofTransformation,
    clearTrackRecordHighlight,
  } = useStore();

  const workingPath = getWorkingPathScenario(state.pathScenarios, state.workingPathScenarioId);

  // Default: the working path. "Verify claims" on Profile's rail deep-links
  // here with ?context=profile. Read directly off the URL (the same
  // convention /opportunities uses for its own query-driven filters) rather
  // than useSearchParams, so this page never needs a Suspense boundary.
  const [context, setContext] = useState<ProofContext>({ type: "path" });
  useEffect(() => {
    function syncContextFromQuery() {
      const params = new URLSearchParams(window.location.search);
      const param = params.get("context");
      if (param === "profile") {
        setContext({ type: "profile" });
      } else if (param === "cv" && state.cvVersions[0]) {
        setContext({ type: "cv", refId: state.cvVersions[0].id });
      } else if (param === "opportunity") {
        const opportunityId = params.get("opportunityId");
        const fallback = state.opportunities[0]?.id;
        setContext({ type: "opportunity", refId: opportunityId ?? fallback });
      }
    }
    syncContextFromQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Build proof from this" on a confirmed Track Record entry sets this
  // highlight and lands here; the evidence layer rings and scrolls to the
  // matching card, the same deep-link pattern Skills and Goals already use.
  const highlightedId = state.highlightedTrackRecordEntryId;
  useEffect(() => {
    if (!highlightedId) return;
    const timeout = setTimeout(() => clearTrackRecordHighlight(highlightedId), TRACK_RECORD_HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [highlightedId, clearTrackRecordHighlight]);

  const rankings = useMemo(
    () => rankEvidenceForContext(context, state.trackRecordEntries, state.opportunities),
    [context, state.trackRecordEntries, state.opportunities]
  );

  const claims = useMemo(
    () => buildClaimsForContext(context, state.profile, state.cvVersions),
    [context, state.profile, state.cvVersions]
  );
  const verifications = useMemo(
    () => verifyClaims(claims, state.trackRecordEntries, state.profile),
    [claims, state.trackRecordEntries, state.profile]
  );

  const transformations = state.proofTransformations.filter((transformation) => {
    if (transformation.contextType !== context.type) return false;
    if (context.type === "cv" || context.type === "opportunity") return transformation.contextRefId === context.refId;
    return true;
  });

  // Goal-Gradient: counted across the whole session, every context, so
  // switching context never resets visible progress.
  const proofsBuilt = state.proofTransformations.filter((transformation) => transformation.state === "accepted").length;
  const allClaims = useMemo(() => {
    const cvClaims = state.cvVersions.flatMap((cv) =>
      buildClaimsForContext({ type: "cv", refId: cv.id }, state.profile, state.cvVersions)
    );
    const profileClaims = buildClaimsForContext({ type: "profile" }, state.profile, state.cvVersions);
    return [...cvClaims, ...profileClaims];
  }, [state.cvVersions, state.profile]);
  const allVerifications = useMemo(
    () => verifyClaims(allClaims, state.trackRecordEntries, state.profile),
    [allClaims, state.trackRecordEntries, state.profile]
  );
  const claimsVerified = allVerifications.filter((verification) => verification.state === "well-supported").length;

  const contextObjectLabel =
    context.type === "cv"
      ? state.cvVersions.find((cv) => cv.id === context.refId)?.name
      : context.type === "opportunity"
        ? formatOpportunityLabel(context.refId, state.opportunities)
        : context.type === "profile"
          ? "your profile"
          : workingPath.title;

  return (
    <WorkspacePage
      title="Proof Builder"
      description="Construct and verify grounded proof from your confirmed Track Record, one context at a time."
    >
      <div className="flex flex-col gap-6">
        <ProofSessionSummary
          proofsBuilt={proofsBuilt}
          totalProofs={state.proofTransformations.length}
          claimsVerified={claimsVerified}
          totalClaims={allVerifications.length}
        />

        <ProofContextPicker
          context={context}
          onChange={setContext}
          cvVersions={state.cvVersions}
          opportunities={state.opportunities}
          workingPathLabel={workingPath.title}
        />

        <section className="flex flex-col gap-3">
          <h2>Evidence for {contextObjectLabel ?? "this context"}</h2>
          <ProofEvidenceLayer rankings={rankings} highlightedEntryId={highlightedId} />
        </section>

        {context.type === "cv" || context.type === "profile" ? (
          <section className="flex flex-col gap-3">
            <h2>Claim verification</h2>
            <ProofClaimVerification verifications={verifications} trackRecordEntries={state.trackRecordEntries} />
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2>Proof transformations</h2>
            <CopilotTag />
          </div>
          {transformations.length === 0 ? (
            <EmptyState message="No proof transformations drafted for this context yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {transformations.map((transformation) => {
                const backingEntries = transformation.backingEntryIds
                  .map((id) => state.trackRecordEntries.find((entry) => entry.id === id))
                  .filter((entry): entry is TrackRecordEntry => Boolean(entry));
                const { targetLabel, confirmationMessage } = describeProofTarget(
                  transformation.target,
                  state.cvVersions,
                  state.opportunities
                );
                return (
                  <ProofTransformationCard
                    key={transformation.id}
                    transformation={transformation}
                    backingEntries={backingEntries}
                    targetLabel={targetLabel}
                    confirmationMessage={confirmationMessage}
                    onAccept={(groundedProof) => acceptProofTransformation(transformation, groundedProof)}
                    onSkip={() => skipProofTransformation(transformation.id)}
                    onUnskip={() => unskipProofTransformation(transformation.id)}
                    onUndo={() => undoProofTransformation(transformation.id)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </WorkspacePage>
  );
}

function formatOpportunityLabel(id: string | undefined, opportunities: { id: string; role: string; company: string }[]) {
  const opportunity = opportunities.find((item) => item.id === id);
  return opportunity ? `${opportunity.role} at ${opportunity.company}` : undefined;
}
