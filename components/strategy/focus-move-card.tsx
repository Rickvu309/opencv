"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Pencil, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddOpportunityDialog } from "@/components/opportunities/add-opportunity-dialog";
import { SaveBackConfirmation } from "@/components/ai/save-back-confirmation";
import { CopilotTag } from "@/components/shared/copilot-tag";
import {
  buildAdjustCandidate,
  buildAdjustDeprioritizeCandidate,
  buildDeprioritizeMove,
  buildFocusMove,
  buildInvestMove,
} from "@/lib/strategy-utils";
import type { StrategyMove } from "@/lib/strategy-utils";
import { useStore } from "@/lib/store";
import type { NextAction, Opportunity, Priority } from "@/lib/types";

// How long the save-back confirmation stays prominent (with Undo showing)
// before the card settles into the quiet done row, matching AiActionCard's
// own settle delay so every five-beat-style card in the app times the same.
const SETTLE_DELAY_MS = 6000;

interface FocusMoveCardProps {
  move: StrategyMove;
  /** Opportunity ids already used by the other slots in this plan, so Adjust never offers a duplicate target. */
  excludeOpportunityIds: string[];
  opportunities: Opportunity[];
  nextActions: NextAction[];
  todayIso: string;
}

function computeAltMove(
  baseMove: StrategyMove,
  opportunities: Opportunity[],
  nextActions: NextAction[],
  excludeIds: string[],
  todayIso: string
): StrategyMove | undefined {
  if (baseMove.kind === "focus" || baseMove.kind === "invest") {
    const candidate = buildAdjustCandidate(baseMove.kind, opportunities, nextActions, excludeIds);
    if (!candidate) return undefined;
    return baseMove.kind === "focus"
      ? buildFocusMove(candidate.opportunity, candidate.action)
      : buildInvestMove(candidate.opportunity, candidate.action);
  }
  if (baseMove.kind === "deprioritize") {
    const candidate = buildAdjustDeprioritizeCandidate(opportunities, excludeIds);
    return candidate ? buildDeprioritizeMove(candidate, todayIso) : undefined;
  }
  return undefined;
}

/**
 * One weekly focus plan move: the move, the plainly-stated expected effect,
 * and Approve, Adjust, Not now controls, settling into a quiet done row
 * after Approve (with Undo first) the same way AiActionCard does.
 */
export function FocusMoveCard({
  move: baseMove,
  excludeOpportunityIds,
  opportunities,
  nextActions,
  todayIso,
}: FocusMoveCardProps) {
  const { state, applyStrategyMove, undoStrategyMove, dismissStrategyMove, undismissStrategyMove } = useStore();
  const [showingAlt, setShowingAlt] = useState(false);
  const [settled, setSettled] = useState(false);
  const [undoPayload, setUndoPayload] = useState<{
    opportunityId?: string;
    nextActionId?: string;
    previousPriority?: Priority;
    activityMomentId?: string;
  } | null>(null);

  const decision = state.strategyMoveStates[baseMove.id];

  const excludeIds = baseMove.opportunityId ? [...excludeOpportunityIds, baseMove.opportunityId] : excludeOpportunityIds;
  const altMove = computeAltMove(baseMove, opportunities, nextActions, excludeIds, todayIso);
  const activeMove = showingAlt && altMove ? altMove : baseMove;
  const opportunity = activeMove.opportunityId
    ? opportunities.find((entry) => entry.id === activeMove.opportunityId)
    : undefined;
  const acceptedNextAction = activeMove.nextActionId
    ? nextActions.find((entry) => entry.id === activeMove.nextActionId)
    : undefined;

  // Resetting settled when decision flips away from "approved" (an Undo)
  // happens during render, the React-recommended way to adjust state on a
  // prop/store change, rather than as a synchronous setState inside the
  // effect below (the same pattern AiActionCard already uses).
  const [trackedDecision, setTrackedDecision] = useState(decision);
  if (decision !== trackedDecision) {
    setTrackedDecision(decision);
    setSettled(false);
  }

  useEffect(() => {
    if (decision !== "approved") return;
    const timeout = window.setTimeout(() => setSettled(true), SETTLE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [decision]);

  function handleApprove() {
    const result = applyStrategyMove(activeMove);
    setUndoPayload({
      opportunityId: result.opportunityId,
      nextActionId: result.nextActionId,
      previousPriority: result.previousPriority,
      activityMomentId: result.activityMomentId,
    });
  }

  function handleUndo() {
    if (!undoPayload) return;
    undoStrategyMove(activeMove.id, undoPayload);
    setUndoPayload(null);
  }

  const confirmationMessage =
    activeMove.kind === "deprioritize"
      ? `${opportunity?.company ?? "Opportunity"} deprioritized to Low, reasoning logged to Activity.`
      : `Accepted: ${acceptedNextAction?.verb ?? activeMove.move}.`;

  if (decision === "dismissed") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
        <p className="text-sm text-muted-foreground">Not now: {activeMove.move}</p>
        <Button size="sm" variant="ghost" onClick={() => undismissStrategyMove(activeMove.id)}>
          Undo
        </Button>
      </div>
    );
  }

  if (decision === "approved" && settled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <Check className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{confirmationMessage}</p>
      </div>
    );
  }

  return (
    <Card className="ring-foreground/8">
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-foreground">{activeMove.move}</p>
          <CopilotTag className="shrink-0" />
        </div>

        {opportunity ? (
          <Link
            href={`/opportunities/${opportunity.id}`}
            className="w-fit text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {opportunity.role} · {opportunity.company}
          </Link>
        ) : null}

        {activeMove.kind === "deprioritize" && activeMove.reasoning ? (
          <p className="text-xs text-muted-foreground">{activeMove.reasoning}</p>
        ) : null}

        {activeMove.kind === "pursue-more" && activeMove.guidance ? (
          <p className="text-xs text-muted-foreground">{activeMove.guidance}</p>
        ) : null}

        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Expected effect</p>
          <p className="text-sm text-foreground">{activeMove.expectedEffect}</p>
        </div>

        {decision === "approved" ? (
          <SaveBackConfirmation message={confirmationMessage} onUndo={handleUndo} />
        ) : activeMove.kind === "pursue-more" ? (
          <div className="flex items-center gap-1.5">
            <AddOpportunityDialog>
              <Button size="sm">
                <Plus className="size-3.5" />
                Add an opportunity
              </Button>
            </AddOpportunityDialog>
            <Button size="sm" variant="ghost" onClick={() => dismissStrategyMove(activeMove.id)}>
              <X className="size-3.5" />
              Not now
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={handleApprove}>
              <Check className="size-3.5" />
              Approve
            </Button>
            {altMove ? (
              <Button size="sm" variant="outline" onClick={() => setShowingAlt((current) => !current)}>
                <Pencil className="size-3.5" />
                {showingAlt ? "Use original" : "Adjust"}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => dismissStrategyMove(activeMove.id)}>
              <X className="size-3.5" />
              Not now
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
