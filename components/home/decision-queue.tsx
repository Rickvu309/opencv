"use client";

import { useState } from "react";
import Link from "next/link";

import { SaveBackConfirmation } from "@/components/ai/save-back-confirmation";
import { DecisionDetailSheet } from "@/components/home/decision-detail-sheet";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AI_SIGNAL_ICON, buildSignalConfirmationMessage } from "@/lib/ai-signal-utils";
import { buildDecisionQueue } from "@/lib/home-utils";
import { NUDGE_ICON, resolveNudgeObjectLabel } from "@/lib/nudge-utils";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { DecisionQueueItem } from "@/lib/home-utils";

// How long a just-approved signal's inline confirmation stays up (with
// Undo) before the row leaves the queue, matching AiActionCard's own
// settle delay so Home's fast-approve path reads exactly like every other
// AiSignal surface in the product.
const SETTLE_DELAY_MS = 6000;

/**
 * Home's "Needs a decision" module (RDS-993): AiSignal and Nudge merged
 * into one ranked list, capped at 3, one line each. A signal's row carries
 * a single fast-path Approve; a nudge's row carries Review. Either row
 * opens the full five-beat or nudge detail in a drawer, the row itself
 * never grows past one line. See docs/architecture.md section 10.
 */
export function DecisionQueue() {
  const { state, approveAiSignal, undoAiSignal } = useStore();
  const [settlingIds, setSettlingIds] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<DecisionQueueItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { items, overflowCount } = buildDecisionQueue(state.aiSignals, state.nudges);

  // A signal that was just approved from the row's own fast path no longer
  // matches buildDecisionQueue's "proposed" filter, but it needs to stay
  // visible through its own confirmation window (see lessons.md #38: a card
  // that leaves its filter the instant it decides never gets to show its
  // own save-back). Appended after the capped items, never counted against
  // the cap since it's the same item settling, not a new one.
  const settlingSignals = state.aiSignals.filter(
    (signal) => settlingIds.has(signal.id) && !items.some((item) => item.id === signal.id)
  );
  const visibleItems: DecisionQueueItem[] = [
    ...items,
    ...settlingSignals.map((signal) => ({ kind: "signal" as const, id: signal.id, signal })),
  ];

  function openReview(item: DecisionQueueItem) {
    setActiveItem(item);
    setSheetOpen(true);
  }

  function handleApprove(signal: DecisionQueueItem & { kind: "signal" }) {
    approveAiSignal(signal.signal.id);
    setSettlingIds((current) => new Set(current).add(signal.signal.id));
    window.setTimeout(() => {
      setSettlingIds((current) => {
        const next = new Set(current);
        next.delete(signal.signal.id);
        return next;
      });
    }, SETTLE_DELAY_MS);
  }

  function handleUndo(signalId: string) {
    undoAiSignal(signalId);
    setSettlingIds((current) => {
      const next = new Set(current);
      next.delete(signalId);
      return next;
    });
  }

  return (
    <section id="decisions" className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>Needs a decision</h2>
        <CopilotTag />
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState message="Nothing needs a decision right now. Copilot brings proposals here as they come up." />
      ) : (
        <Card className="ring-foreground/8 py-0">
          <CardContent className="flex flex-col gap-0 px-0">
            {visibleItems.map((item, index) => (
              <div key={item.id} className={cn("px-4 py-3", index > 0 && "border-t border-border")}>
                {item.kind === "signal" && settlingIds.has(item.id) ? (
                  <SaveBackConfirmation
                    message={buildSignalConfirmationMessage(item.signal)}
                    onUndo={() => handleUndo(item.signal.id)}
                  />
                ) : (
                  <DecisionRow
                    item={item}
                    onReview={() => openReview(item)}
                    onApprove={item.kind === "signal" ? () => handleApprove(item) : undefined}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {overflowCount > 0 ? (
        <Link
          href="/opportunities"
          className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          +{overflowCount} more in Opportunities
        </Link>
      ) : null}

      <DecisionDetailSheet item={activeItem} open={sheetOpen} onOpenChange={setSheetOpen} />
    </section>
  );
}

interface DecisionRowProps {
  item: DecisionQueueItem;
  onReview: () => void;
  onApprove?: () => void;
}

function DecisionRow({ item, onReview, onApprove }: DecisionRowProps) {
  const { state } = useStore();

  const Icon = item.kind === "signal" ? AI_SIGNAL_ICON[item.signal.iconKind] : NUDGE_ICON[item.nudge.trigger];
  const primaryText = item.kind === "signal" ? item.signal.signal : item.nudge.message;
  const objectLabel =
    item.kind === "signal"
      ? (() => {
          const opportunity = state.opportunities.find((entry) => entry.id === item.signal.opportunityId);
          return opportunity ? `${opportunity.role} · ${opportunity.company}` : "Opportunity";
        })()
      : resolveNudgeObjectLabel(item.nudge, state.opportunities, state.goals, state.learningItems);

  return (
    <div className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-3.5" />
      </span>
      <button
        type="button"
        onClick={onReview}
        className="flex min-w-0 flex-1 items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{primaryText}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{objectLabel}</span>
      </button>
      {onApprove ? (
        <Button size="sm" className="shrink-0" onClick={onApprove}>
          Approve
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="shrink-0" onClick={onReview}>
          Review
        </Button>
      )}
    </div>
  );
}
