"use client";

import { useState } from "react";

import { CopilotTag } from "@/components/shared/copilot-tag";
import { FocusMoveCard } from "@/components/strategy/focus-move-card";
import { StrategyPlanCompletionCard } from "@/components/strategy/strategy-plan-completion-card";
import { buildWeeklyFocusPlan } from "@/lib/strategy-utils";
import type { StrategyMove } from "@/lib/strategy-utils";
import { useStore } from "@/lib/store";
import type { Goal, NextAction, Opportunity } from "@/lib/types";

interface WeeklyFocusPlanProps {
  opportunities: Opportunity[];
  nextActions: NextAction[];
  goals: Goal[];
  todayIso: string;
}

/**
 * The coach core: up to 4 moves (Hick's Law caps this at 4, one primary
 * action each), computed once on mount so the plan reads as set for the
 * week rather than reshuffling every time an earlier move's approval
 * changes the data it was ranked from (see lib/strategy-utils.ts's
 * buildWeeklyFocusPlan doc comment). Ends in a quiet Peak-End completion
 * state naming the count of moves made.
 */
export function WeeklyFocusPlan({ opportunities, nextActions, goals, todayIso }: WeeklyFocusPlanProps) {
  const { state } = useStore();
  const [plan] = useState<StrategyMove[]>(() => buildWeeklyFocusPlan(opportunities, nextActions, goals, todayIso));

  const decisions = plan.map((move) => state.strategyMoveStates[move.id]);
  const approvedCount = decisions.filter((decision) => decision === "approved").length;
  const decidedCount = decisions.filter((decision) => Boolean(decision)).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>This week&rsquo;s focus plan</h2>
        <CopilotTag />
      </div>
      <div className="flex flex-col gap-3">
        {plan.map((move) => (
          <FocusMoveCard
            key={move.id}
            move={move}
            excludeOpportunityIds={plan
              .filter((entry) => entry.id !== move.id)
              .map((entry) => entry.opportunityId)
              .filter((id): id is string => Boolean(id))}
            opportunities={opportunities}
            nextActions={nextActions}
            todayIso={todayIso}
          />
        ))}
      </div>
      <StrategyPlanCompletionCard totalMoves={plan.length} approvedCount={approvedCount} decidedCount={decidedCount} />
    </section>
  );
}
