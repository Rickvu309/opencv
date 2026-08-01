"use client";

import { RecommendedPathCard } from "@/components/planner/recommended-path-card";
import { MilestoneNode } from "@/components/roadmap/milestone-node";
import { roadmapMilestones } from "@/lib/data/roadmap";
import { getRecommendedNextMove, getWorkingPathScenario } from "@/lib/planner-utils";
import { computeMilestoneProgress, getMilestonesForScenario, getResourcesForMilestone } from "@/lib/roadmap-utils";
import { useStore } from "@/lib/store";

/**
 * Signature workflow 4: the same working path, first as the Path Planner's
 * decisive summary, then as the Roadmap's first staged milestone, real
 * live progress included, so the showcase itself demonstrates "a working
 * path, not just an insight" rather than just claiming it in copy.
 */
export function PlannerRoadmapShowcase() {
  const { state } = useStore();

  const workingScenario = getWorkingPathScenario(state.pathScenarios, state.workingPathScenarioId);
  const nextMove = getRecommendedNextMove(state.planItems, workingScenario.id);
  const milestones = getMilestonesForScenario(roadmapMilestones, workingScenario.id);
  const firstMilestone = milestones[0];
  if (!firstMilestone) return null;

  const progress = computeMilestoneProgress(firstMilestone, state.skills, state.planItems, state.trackRecordEntries);
  const resources = getResourcesForMilestone(state.roadmapResources, firstMilestone.id);

  return (
    <div className="flex w-[760px] flex-col gap-3 p-5">
      <RecommendedPathCard
        scenario={workingScenario}
        nextMove={nextMove}
        profile={state.profile}
        skills={state.skills}
        goals={state.goals}
        opportunities={state.opportunities}
        trackRecordEntries={state.trackRecordEntries}
        learningItems={state.learningItems}
      />
      <MilestoneNode
        milestone={firstMilestone}
        status="in-progress"
        progress={progress}
        resources={resources}
        skills={state.skills}
        planItems={state.planItems}
        trackRecordEntries={state.trackRecordEntries}
      />
    </div>
  );
}
