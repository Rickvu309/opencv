"use client";

import { PlannerPage } from "@/components/shell/planner-page";
import { ConnectionsSection } from "@/components/roadmap/connections-section";
import { DoTodayCard } from "@/components/roadmap/do-today-card";
import { MilestoneJourneySection } from "@/components/roadmap/milestone-journey";
import { RoadmapOrientationBand } from "@/components/roadmap/orientation-band";
import { roadmapMilestones } from "@/lib/data/roadmap";
import { getRecommendedNextMove, getWorkingPathScenario } from "@/lib/planner-utils";
import {
  computeMilestoneProgress,
  computeMilestoneStatuses,
  computeRoadmapProgress,
  getMilestonesForScenario,
  getOrientationSkills,
  getStrengthensOpportunities,
  type MilestoneProgress,
} from "@/lib/roadmap-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function RoadmapPage() {
  useCopilotSurface("Roadmap");
  const { state } = useStore();

  const workingScenario = getWorkingPathScenario(state.pathScenarios, state.workingPathScenarioId);
  const milestones = getMilestonesForScenario(roadmapMilestones, workingScenario.id);
  const scenarioResources = state.roadmapResources.filter((resource) => resource.scenarioId === workingScenario.id);
  const nextMove = getRecommendedNextMove(state.planItems, workingScenario.id);
  const orientationSkills = getOrientationSkills(workingScenario.id, state.skills);
  const strengthensOpportunities = getStrengthensOpportunities(workingScenario.id, state.opportunities);

  const progressByMilestoneId = milestones.reduce<Record<string, MilestoneProgress>>((acc, milestone) => {
    acc[milestone.id] = computeMilestoneProgress(milestone, state.skills, state.planItems, state.trackRecordEntries);
    return acc;
  }, {});
  const statuses = computeMilestoneStatuses(milestones, progressByMilestoneId);
  const roadmapProgress = computeRoadmapProgress(milestones, state.skills, state.planItems, state.trackRecordEntries);

  return (
    <PlannerPage
      title="Roadmap"
      description="Your working path, turned into a guided, staged journey with concrete resources."
      band={
        <RoadmapOrientationBand
          profile={state.profile}
          scenario={workingScenario}
          orientationSkills={orientationSkills}
          progress={roadmapProgress}
        />
      }
    >
      <DoTodayCard
        item={nextMove}
        skills={state.skills}
        goals={state.goals}
        opportunities={state.opportunities}
        trackRecordEntries={state.trackRecordEntries}
        learningItems={state.learningItems}
      />

      <MilestoneJourneySection
        milestones={milestones}
        statuses={statuses}
        progressByMilestoneId={progressByMilestoneId}
        resources={scenarioResources}
        skills={state.skills}
        planItems={state.planItems}
        trackRecordEntries={state.trackRecordEntries}
      />

      <ConnectionsSection strengthensOpportunities={strengthensOpportunities} />
    </PlannerPage>
  );
}
