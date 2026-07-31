"use client";

import { PlannerPage } from "@/components/shell/planner-page";
import { RecommendedPathCard } from "@/components/planner/recommended-path-card";
import { getRecommendedNextMove, getWorkingPathScenario } from "@/lib/planner-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function PathPlannerPage() {
  useCopilotSurface("Path Planner");
  const { state } = useStore();

  const workingScenario = getWorkingPathScenario(state.pathScenarios, state.workingPathScenarioId);
  const nextMove = getRecommendedNextMove(state.planItems, workingScenario.id);

  return (
    <PlannerPage
      title="Path Planner"
      description="Your recommended direction, the alternatives, what's missing, and the staged plan to close it."
    >
      <RecommendedPathCard
        scenario={workingScenario}
        nextMove={nextMove}
        skills={state.skills}
        goals={state.goals}
        opportunities={state.opportunities}
        trackRecordEntries={state.trackRecordEntries}
        learningItems={state.learningItems}
      />
    </PlannerPage>
  );
}
