import type { LucideIcon } from "lucide-react";
import { AlarmClock, Flame, GraduationCap, Inbox, ListChecks, Pin, Target } from "lucide-react";

import type { Goal, LearningItem, Nudge, NudgeTrigger, Opportunity } from "@/lib/types";

// Shared read-only helpers for Home's decision queue: trigger labels and
// icons, the object a nudge names, queue ranking, and the stable id a
// pinned Nudge uses so promoting the same source suggestion twice never
// duplicates it. Kept separate from lib/store/ so the queue's ranking
// logic stays plain and testable against plain data.

export const NUDGE_TRIGGER_LABEL: Record<NudgeTrigger, string> = {
  "stale-opportunity": "Stale opportunity",
  "high-potential": "High potential",
  "missing-next-step": "Missing next step",
  "capture-prompt": "Capture prompt",
  "goal-reminder": "Goal reminder",
  "learning-nudge": "Learning nudge",
  "rewind-carry-forward": "Carried forward",
};

export const NUDGE_ICON: Record<NudgeTrigger, LucideIcon> = {
  "stale-opportunity": AlarmClock,
  "high-potential": Flame,
  "missing-next-step": ListChecks,
  "capture-prompt": Inbox,
  "goal-reminder": Target,
  "learning-nudge": GraduationCap,
  "rewind-carry-forward": Pin,
};

/** The object a nudge's message is about, for the decision queue's drawer header. Falls back to the trigger label when a nudge names no specific related object (capture-prompt). */
export function resolveNudgeObjectLabel(
  nudge: Nudge,
  opportunities: Opportunity[],
  goals: Goal[],
  learningItems: LearningItem[]
): string {
  if (nudge.relatedOpportunityId) {
    const opportunity = opportunities.find((item) => item.id === nudge.relatedOpportunityId);
    if (opportunity) return `${opportunity.role} · ${opportunity.company}`;
  }
  if (nudge.relatedGoalId) {
    const goal = goals.find((item) => item.id === nudge.relatedGoalId);
    if (goal) return goal.title;
  }
  if (nudge.relatedLearningItemId) {
    const learningItem = learningItems.find((item) => item.id === nudge.relatedLearningItemId);
    if (learningItem) return learningItem.title;
  }
  return NUDGE_TRIGGER_LABEL[nudge.trigger];
}

/**
 * The merged, prioritized attention queue: pinned items (promoted from an
 * accepted Rewind carry-forward) always float to the top, the rest keep
 * their seed order. Capped at 6 so the queue stays "few and relevant, not
 * noisy" even once Rewind starts pinning items on top of the seeded set.
 */
export function getAttentionQueue(nudges: Nudge[]): Nudge[] {
  const active = nudges.filter((nudge) => nudge.state === "active");
  const pinned = active.filter((nudge) => nudge.pinned);
  const rest = active.filter((nudge) => !nudge.pinned);
  return [...pinned, ...rest].slice(0, 6);
}

/** Stable id for the Nudge a given source item (a Rewind carry-forward) pins, so accepting it twice never duplicates the card. */
export function pinnedNudgeId(sourceId: string): string {
  return `pinned-${sourceId}`;
}
