import type { Nudge, NudgeTrigger, WeeklyReviewSuggestion } from "@/lib/types";

// Shared read-only helpers for the Home attention queue: family grouping,
// queue ranking, and the pinned-nudge bridge from an accepted Weekly Review
// suggestion. Kept separate from lib/store.tsx so the queue's ranking logic
// stays plain and testable against plain data.

export type NudgeFamily = "opportunity" | "capture" | "goal" | "learning" | "focus";

/**
 * Groups the six seeded triggers into the four families the attention queue
 * is required to cover. "weekly-focus" sits outside the four, it only ever
 * appears once a Weekly Review suggestion is accepted.
 */
export const NUDGE_FAMILY: Record<NudgeTrigger, NudgeFamily> = {
  "stale-opportunity": "opportunity",
  "high-potential": "opportunity",
  "missing-next-step": "opportunity",
  "capture-prompt": "capture",
  "goal-reminder": "goal",
  "learning-nudge": "learning",
  "weekly-focus": "focus",
};

export const NUDGE_TRIGGER_LABEL: Record<NudgeTrigger, string> = {
  "stale-opportunity": "Stale opportunity",
  "high-potential": "High potential",
  "missing-next-step": "Missing next step",
  "capture-prompt": "Capture prompt",
  "goal-reminder": "Goal reminder",
  "learning-nudge": "Learning nudge",
  "weekly-focus": "Pinned focus",
};

/**
 * The merged, prioritized attention queue: pinned items (promoted from an
 * accepted Weekly Review focus suggestion) always float to the top, the rest
 * keep their seed order. Capped at 6 so the queue stays "few and relevant,
 * not noisy" even once Weekly Review starts pinning items on top of the
 * seeded set.
 */
export function getAttentionQueue(nudges: Nudge[]): Nudge[] {
  const active = nudges.filter((nudge) => nudge.state === "active");
  const pinned = active.filter((nudge) => nudge.pinned);
  const rest = active.filter((nudge) => !nudge.pinned);
  return [...pinned, ...rest].slice(0, 6);
}

/** Stable id for the Nudge a given Weekly Review suggestion pins, so accepting it twice never duplicates the card. */
export function pinnedNudgeId(suggestionId: string): string {
  return `pinned-${suggestionId}`;
}

/** Builds the pinned Nudge an accepted Weekly Review focus suggestion promotes into the Home attention queue. */
export function buildPinnedNudgeFromSuggestion(suggestion: WeeklyReviewSuggestion): Nudge {
  return {
    id: pinnedNudgeId(suggestion.id),
    trigger: "weekly-focus",
    message: suggestion.text,
    why: "Pinned from this week's Weekly Review, worth keeping in view until it's done.",
    actions: [{ label: suggestion.actionLabel, href: suggestion.actionHref }],
    state: "active",
    pinned: true,
  };
}
