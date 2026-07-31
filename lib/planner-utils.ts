import type { PathScenario, PlanItem, PlanStage } from "@/lib/types";

// Shared read-only helpers for the Path Planner: resolving the working path,
// grouping its growth plan by stage, and reading the pinned recommended next
// move. Kept separate from lib/store.tsx so the planner page and its
// sections stay thin and testable against plain data, the same split
// lib/opportunity-utils.ts and lib/inbox-utils.ts already use.

export const PLAN_STAGES: { key: PlanStage; label: string }[] = [
  { key: "now", label: "Now" },
  { key: "months-1-3", label: "Months 1 to 3" },
  { key: "months-4-6", label: "Months 4 to 6" },
];

/**
 * The current working path: whichever PathScenario workingPathScenarioId
 * points at, falling back to the scenario flagged closest to the current
 * trajectory, then the first seeded scenario, so the recommended zone
 * always has something to render.
 */
export function getWorkingPathScenario(
  pathScenarios: PathScenario[],
  workingPathScenarioId: string
): PathScenario {
  return (
    pathScenarios.find((scenario) => scenario.id === workingPathScenarioId) ??
    pathScenarios.find((scenario) => scenario.isClosestToCurrentTrajectory) ??
    pathScenarios[0]
  );
}

export function getAlternativeScenarios(
  pathScenarios: PathScenario[],
  workingPathScenarioId: string
): PathScenario[] {
  return pathScenarios.filter((scenario) => scenario.id !== workingPathScenarioId);
}

export function getPlanItemsForScenario(planItems: PlanItem[], scenarioId: string): PlanItem[] {
  return planItems.filter((item) => item.scenarioId === scenarioId);
}

export function groupPlanItemsByStage(items: PlanItem[]): Record<PlanStage, PlanItem[]> {
  return {
    now: items.filter((item) => item.stage === "now"),
    "months-1-3": items.filter((item) => item.stage === "months-1-3"),
    "months-4-6": items.filter((item) => item.stage === "months-4-6"),
  };
}

/**
 * The single most important next move (Serial Position): stage 1's first
 * item for the working path, seed-order preserved. Zone 2 pins this exact
 * item, so it always matches stage 1 item 1 of the roadmap in zone 5.
 */
export function getRecommendedNextMove(planItems: PlanItem[], scenarioId: string): PlanItem | undefined {
  return planItems.find((item) => item.scenarioId === scenarioId && item.stage === "now");
}

export interface StageProgress {
  done: number;
  total: number;
}

/**
 * Goal-Gradient progress for one stage: already-done or already-accepted
 * items over the total, so the roadmap never reads as starting from zero.
 */
export function computeStageProgress(items: PlanItem[]): StageProgress {
  const done = items.filter((item) => item.alreadyDone || item.state === "accepted").length;
  return { done, total: items.length };
}
