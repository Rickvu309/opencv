import { roadmapOrientationSkillIds, roadmapStrengthensOpportunityIds } from "@/lib/data/roadmap";
import type {
  LearningItemType,
  MilestoneProofItem,
  MilestoneSkillMove,
  MilestoneStatus,
  Opportunity,
  PlanItem,
  RoadmapMilestone,
  RoadmapResource,
  RoadmapResourceType,
  Skill,
  TrackRecordEntry,
} from "@/lib/types";

// Shared read-only helpers for the Roadmap: everything here reads live store
// state (skills, plan items, track record entries) rather than a stored
// progress number, so completing a plan item or confirming an achievement
// (Rewind) moves a milestone's progress the same render it happens in.

/** The 3 milestones for one scenario, seed order already ascending but sorted defensively by `order`. */
export function getMilestonesForScenario(milestones: RoadmapMilestone[], scenarioId: string): RoadmapMilestone[] {
  return milestones.filter((milestone) => milestone.scenarioId === scenarioId).sort((a, b) => a.order - b.order);
}

/** A milestone's resources, dismissed ones filtered out (Not for me removes it from view; Undo brings it back). */
export function getResourcesForMilestone(resources: RoadmapResource[], milestoneId: string): RoadmapResource[] {
  return resources.filter((resource) => resource.milestoneId === milestoneId && resource.state !== "dismissed");
}

/** A skill move is done once the skill's live level has reached toLevel. */
export function isSkillMoveDone(move: MilestoneSkillMove, skills: Skill[]): boolean {
  const skill = skills.find((candidate) => candidate.id === move.skillId);
  return (skill?.level ?? 0) >= move.toLevel;
}

/**
 * A proof item is done once whatever it's linked to says so: an accepted or
 * already-done PlanItem, or a confirmed TrackRecordEntry. A bare proposed
 * capture action (neither link present) is never auto-marked done, the same
 * trust-boundary rule the rest of the app follows: nothing applies itself.
 */
export function isProofItemDone(
  item: MilestoneProofItem,
  planItems: PlanItem[],
  trackRecordEntries: TrackRecordEntry[]
): boolean {
  if (item.linkedPlanItemId) {
    const planItem = planItems.find((candidate) => candidate.id === item.linkedPlanItemId);
    return Boolean(planItem?.alreadyDone || planItem?.state === "accepted");
  }
  if (item.trackRecordEntryId) {
    const entry = trackRecordEntries.find((candidate) => candidate.id === item.trackRecordEntryId);
    return entry?.status === "confirmed";
  }
  return false;
}

export interface MilestoneProgress {
  done: number;
  total: number;
}

/** Goal-Gradient progress for one milestone: skill moves plus proof items, live. */
export function computeMilestoneProgress(
  milestone: RoadmapMilestone,
  skills: Skill[],
  planItems: PlanItem[],
  trackRecordEntries: TrackRecordEntry[]
): MilestoneProgress {
  const skillDone = milestone.skillMoves.filter((move) => isSkillMoveDone(move, skills)).length;
  const proofDone = milestone.proofItems.filter((item) => isProofItemDone(item, planItems, trackRecordEntries)).length;
  return {
    done: skillDone + proofDone,
    total: milestone.skillMoves.length + milestone.proofItems.length,
  };
}

/**
 * Status for every milestone in a scenario, in one pass: every milestone
 * before the first one with zero progress reads "in progress" (started, even
 * once finished, since the journey has only 3 states), that first
 * zero-progress milestone reads "up next", everything after it "later".
 */
export function computeMilestoneStatuses(
  milestones: RoadmapMilestone[],
  progressByMilestoneId: Record<string, MilestoneProgress>
): Record<string, MilestoneStatus> {
  const firstUnstartedIndex = milestones.findIndex((milestone) => progressByMilestoneId[milestone.id]?.done === 0);

  const statuses: Record<string, MilestoneStatus> = {};
  milestones.forEach((milestone, index) => {
    if (firstUnstartedIndex === -1 || index < firstUnstartedIndex) {
      statuses[milestone.id] = "in-progress";
    } else if (index === firstUnstartedIndex) {
      statuses[milestone.id] = "up-next";
    } else {
      statuses[milestone.id] = "later";
    }
  });
  return statuses;
}

export interface RoadmapProgress extends MilestoneProgress {
  percent: number;
}

/** Overall roadmap progress across all 3 milestones, backing the orientation band's bridge. */
export function computeRoadmapProgress(
  milestones: RoadmapMilestone[],
  skills: Skill[],
  planItems: PlanItem[],
  trackRecordEntries: TrackRecordEntry[]
): RoadmapProgress {
  const totals = milestones.reduce(
    (acc, milestone) => {
      const progress = computeMilestoneProgress(milestone, skills, planItems, trackRecordEntries);
      return { done: acc.done + progress.done, total: acc.total + progress.total };
    },
    { done: 0, total: 0 }
  );
  return { ...totals, percent: totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0 };
}

/** The 2 strongest skills relevant to a scenario, shown in the orientation band's "Now" pole. */
export function getOrientationSkills(scenarioId: string, skills: Skill[]): Skill[] {
  const ids = roadmapOrientationSkillIds[scenarioId];
  if (!ids) {
    return [...skills].sort((a, b) => b.level - a.level).slice(0, 2);
  }
  return ids.map((id) => skills.find((skill) => skill.id === id)).filter((skill): skill is Skill => Boolean(skill));
}

/** Renders a stored sequence value ("now" or "after X") as its display form ("Now" or "After X"). */
export function formatSequence(sequence: string): string {
  return sequence.charAt(0).toUpperCase() + sequence.slice(1);
}

/** The 2 named opportunities a scenario most directly strengthens, shown in the roadmap's Connections zone. */
export function getStrengthensOpportunities(scenarioId: string, opportunities: Opportunity[]): Opportunity[] {
  const ids = roadmapStrengthensOpportunityIds[scenarioId];
  if (!ids) return [];
  return ids.map((id) => opportunities.find((opportunity) => opportunity.id === id)).filter((opportunity): opportunity is Opportunity => Boolean(opportunity));
}

const RESOURCE_TYPE_LABELS: Record<RoadmapResourceType, string> = {
  course: "Course",
  "project-brief": "Project brief",
  "practice-routine": "Practice routine",
  community: "Community",
};

export function resourceTypeLabel(type: RoadmapResourceType): string {
  return RESOURCE_TYPE_LABELS[type];
}

// A resource's type maps to a PlanItem type (what stage-column badge it gets
// on /planner) and a LearningItem type (what it reads as on /skills). A
// project brief is hands-on build work, matching the existing "build" plan
// item this same wording already uses elsewhere in the growth plan; every
// other resource type reads as "learn".
export function resourceToPlanItemType(type: RoadmapResourceType): "learn" | "build" {
  return type === "project-brief" ? "build" : "learn";
}

const RESOURCE_TO_LEARNING_ITEM_TYPE: Record<RoadmapResourceType, LearningItemType> = {
  course: "course",
  "project-brief": "project",
  "practice-routine": "habit",
  community: "habit",
};

export function resourceToLearningItemType(type: RoadmapResourceType): LearningItemType {
  return RESOURCE_TO_LEARNING_ITEM_TYPE[type];
}
