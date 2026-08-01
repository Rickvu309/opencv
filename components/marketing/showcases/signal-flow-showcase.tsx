"use client";

import { useEffect, useRef, useState } from "react";

import { AiActionCard } from "@/components/ai/ai-action-card";
import { AI_SIGNAL_ICON, buildSignalConfirmationMessage, findSignalEvidence } from "@/lib/ai-signal-utils";
import { aiSignals } from "@/lib/data/ai-signals";
import { opportunities } from "@/lib/data/opportunities";

const signal = aiSignals.find((candidate) => candidate.id === "signal-meridian-panel-format")!;
const opportunity = opportunities.find((candidate) => candidate.id === signal.opportunityId)!;
const evidence = findSignalEvidence(signal)!;

/**
 * The showcase's own state-transition beat (brief section 5): once this
 * composition scrolls into view, it plays the exact five-beat approve
 * moment the real product uses, Signal through the save-back confirmation,
 * entirely in local state so the landing page never touches real store
 * data. A no-op function, not the connected SignalCard, since this is a
 * decorative demonstration, not a live action a visitor can actually take.
 */
export function SignalFlowShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let timeout: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            timeout = window.setTimeout(() => setApproved(true), 1600);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timeout) window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div ref={ref} className="p-5">
      <AiActionCard
        icon={AI_SIGNAL_ICON[signal.iconKind]}
        context={
          <span className="text-xs font-medium text-muted-foreground">
            {opportunity.role} · {opportunity.company}
          </span>
        }
        signal={signal.signal}
        whyItMatters={signal.whyItMatters}
        evidence={evidence}
        proposedAction={signal.proposedAction}
        approved={approved}
        confirmationMessage={buildSignalConfirmationMessage(signal)}
        onApprove={() => setApproved(true)}
        onDismiss={() => {}}
        onUndo={() => setApproved(false)}
      />
    </div>
  );
}
