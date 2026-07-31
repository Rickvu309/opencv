"use client";

import { ReviewQueue } from "@/components/ai/review-queue";
import { SignalCard } from "@/components/ai/signal-card";
import { useStore } from "@/lib/store";

/**
 * The Signals area on an opportunity's Overview tab: a ReviewQueue of
 * AiActionCards grounded in this opportunity's connected-source evidence.
 * Sits above the fold, below the summary band, so the opportunity stays
 * the center and evidence stays secondary but visible.
 */
export function OpportunitySignalsSection({ opportunityId }: { opportunityId: string }) {
  const { state } = useStore();

  const signals = state.aiSignals.filter(
    (signal) => signal.opportunityId === opportunityId && signal.state !== "dismissed"
  );

  return (
    <ReviewQueue
      title="Signals"
      count={signals.length}
      emptyMessage="No new signals from your connected sources for this opportunity."
    >
      {signals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </ReviewQueue>
  );
}
