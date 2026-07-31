"use client";

import { ReviewQueue } from "@/components/ai/review-queue";
import { SignalCard } from "@/components/ai/signal-card";
import { LinkedEvidenceList } from "@/components/sources/linked-evidence-list";
import { getLinkedInboxItemsFor } from "@/lib/inbox-utils";
import { useStore } from "@/lib/store";

/**
 * The Signals area on an opportunity's Overview tab: a ReviewQueue of
 * AiActionCards grounded in this opportunity's connected-source evidence,
 * plus anything linked to it from the /sources synced-context inbox. Sits
 * above the fold, below the summary band, so the opportunity stays the
 * center and evidence stays secondary but visible.
 */
export function OpportunitySignalsSection({ opportunityId }: { opportunityId: string }) {
  const { state } = useStore();

  const signals = state.aiSignals.filter(
    (signal) => signal.opportunityId === opportunityId && signal.state !== "dismissed"
  );
  const linkedEvidence = getLinkedInboxItemsFor(state, "opportunity", opportunityId);

  return (
    <div className="flex flex-col gap-3">
      <ReviewQueue
        title="Signals"
        count={signals.length}
        emptyMessage="No new signals from your connected sources for this opportunity."
      >
        {signals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </ReviewQueue>

      {linkedEvidence.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Linked from your sources</p>
          <LinkedEvidenceList items={linkedEvidence} />
        </div>
      ) : null}
    </div>
  );
}
