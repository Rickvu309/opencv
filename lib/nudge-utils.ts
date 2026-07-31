import type { Nudge, NudgeTrigger } from "@/lib/types";

// Shared read-only helpers for the Home attention queue: family grouping,
// queue ranking, and the stable id a pinned Nudge uses so promoting the
// same source suggestion twice never duplicates it. Kept separate from
// lib/store.tsx so the queue's ranking logic stays plain and testable
// against plain data.

export type NudgeFamily = "opportunity" | "capture" | "goal" | "learning" | "focus";

/**
 * Groups the six seeded triggers into the four families the attention queue
 * is required to cover. "rewind-carry-forward" sits outside the four, it
 * only ever appears once a Rewind carry-forward is accepted.
 */
export const NUDGE_FAMILY: Record<NudgeTrigger, NudgeFamily> = {
  "stale-opportunity": "opportunity",
  "high-potential": "opportunity",
  "missing-next-step": "opportunity",
  "capture-prompt": "capture",
  "goal-reminder": "goal",
  "learning-nudge": "learning",
  "rewind-carry-forward": "focus",
};

export const NUDGE_TRIGGER_LABEL: Record<NudgeTrigger, string> = {
  "stale-opportunity": "Stale opportunity",
  "high-potential": "High potential",
  "missing-next-step": "Missing next step",
  "capture-prompt": "Capture prompt",
  "goal-reminder": "Goal reminder",
  "learning-nudge": "Learning nudge",
  "rewind-carry-forward": "Carried forward",
};

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
