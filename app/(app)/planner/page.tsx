"use client";

import { PlannerPage } from "@/components/shell/planner-page";
import { AlternativesSection } from "@/components/planner/alternatives-section";
import { GapProofSection } from "@/components/planner/gap-proof-section";
import { GrowthPlanSection } from "@/components/planner/growth-plan-section";
import { RecommendedPathCard } from "@/components/planner/recommended-path-card";
import { whatWouldChangeRanking } from "@/lib/data/planner";
import {
  getAlternativeScenarios,
  getPlanItemsForScenario,
  getRecommendedNextMove,
  getWorkingPathScenario,
} from "@/lib/planner-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function PathPlannerPage() {
  useCopilotSurface("Path Planner");
  const { state, setScenarioAsTargetDirection } = useStore();

  const workingScenario = getWorkingPathScenario(state.pathScenarios, state.workingPathScenarioId);
  const alternatives = getAlternativeScenarios(state.pathScenarios, workingScenario.id);
  const workingPlanItems = getPlanItemsForScenario(state.planItems, workingScenario.id);
  const nextMove = getRecommendedNextMove(state.planItems, workingScenario.id);
  const gapAnalysis = state.plannerGapAnalyses.find((entry) => entry.scenarioId === workingScenario.id);

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

      <AlternativesSection
        alternatives={alternatives}
        whatWouldChangeRanking={whatWouldChangeRanking}
        onChoose={setScenarioAsTargetDirection}
      />

      {gapAnalysis ? (
        <GapProofSection
          scenarioTitle={workingScenario.title}
          gapAnalysis={gapAnalysis}
          skills={state.skills}
          insights={state.insights}
          learningItems={state.learningItems}
          uncertain={state.directionGapAnalysis.uncertain}
        />
      ) : null}

      <GrowthPlanSection
        items={workingPlanItems}
        skills={state.skills}
        goals={state.goals}
        opportunities={state.opportunities}
        trackRecordEntries={state.trackRecordEntries}
        learningItems={state.learningItems}
      />
    </PlannerPage>
  );
}
