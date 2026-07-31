"use client";

import { PlannerPage } from "@/components/shell/planner-page";
import { getWorkingPathScenario } from "@/lib/planner-utils";
import { useCopilotSurface, useStore } from "@/lib/store";

export default function PathPlannerPage() {
  useCopilotSurface("Path Planner");
  const { state } = useStore();

  const workingScenario = getWorkingPathScenario(state.pathScenarios, state.workingPathScenarioId);

  return (
    <PlannerPage
      title="Path Planner"
      description="Your recommended direction, the alternatives, what's missing, and the staged plan to close it."
    >
      <p className="text-sm text-muted-foreground">Working path: {workingScenario.title}</p>
    </PlannerPage>
  );
}
