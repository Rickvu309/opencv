import { getAttentionQueue } from "@/lib/nudge-utils";
import type { ActivityMoment, AiSignal, Nudge, Opportunity } from "@/lib/types";

// Shared read-only helpers behind Home's redesigned modules (RDS-993): the
// merged decision queue, the what-changed digest, and the entry tiles' own
// state read. Kept separate from lib/store/ so Home's components stay thin
// and testable against plain data, the same split every other surface's
// own *-utils.ts file already uses.

// ---------------------------------------------------------------------------
// "Needs a decision": AiSignal and Nudge merged into one ranked, capped list.
// ---------------------------------------------------------------------------

export type DecisionQueueItem =
  | { kind: "signal"; id: string; signal: AiSignal }
  | { kind: "nudge"; id: string; nudge: Nudge };

/** Miller's Law: never more than a glance's worth of open decisions on Home at once. */
export const DECISION_QUEUE_LIMIT = 3;

export interface DecisionQueue {
  items: DecisionQueueItem[];
  overflowCount: number;
}

/**
 * Signals first (grounded in evidence, reversible with Undo), then active
 * nudges (pinned carry-forwards first, via getAttentionQueue), capped at 3.
 * Everything past the cap is one honest count, not a second hidden list.
 */
export function buildDecisionQueue(aiSignals: AiSignal[], nudges: Nudge[]): DecisionQueue {
  const proposedSignals = aiSignals.filter((signal) => signal.state === "proposed");
  const activeNudges = getAttentionQueue(nudges);

  const combined: DecisionQueueItem[] = [
    ...proposedSignals.map((signal) => ({ kind: "signal" as const, id: signal.id, signal })),
    ...activeNudges.map((nudge) => ({ kind: "nudge" as const, id: nudge.id, nudge })),
  ];

  return {
    items: combined.slice(0, DECISION_QUEUE_LIMIT),
    overflowCount: Math.max(0, combined.length - DECISION_QUEUE_LIMIT),
  };
}

// ---------------------------------------------------------------------------
// "What changed": the most recent activity, read straight off the existing
// per-opportunity Activity log, no new data shape.
// ---------------------------------------------------------------------------

export const WHAT_CHANGED_LIMIT = 4;

export interface WhatChangedItem {
  id: string;
  message: string;
  kind: ActivityMoment["kind"];
  objectLabel: string;
  href: string;
  createdAt: string;
}

export function buildWhatChangedDigest(
  activityMoments: ActivityMoment[],
  opportunities: Opportunity[],
  limit = WHAT_CHANGED_LIMIT
): WhatChangedItem[] {
  return [...activityMoments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((moment) => {
      const opportunity = opportunities.find((item) => item.id === moment.opportunityId);
      return {
        id: moment.id,
        message: moment.message,
        kind: moment.kind,
        objectLabel: opportunity ? `${opportunity.role} · ${opportunity.company}` : "Opportunity",
        href: opportunity ? `/opportunities/${opportunity.id}#activity` : "/opportunities",
        createdAt: moment.createdAt,
      };
    });
}

// ---------------------------------------------------------------------------
// Entry tiles: Rewind and Strategy are weekly-cadence surfaces, so Home
// shows only a state chip and one line, never their own content.
// ---------------------------------------------------------------------------

export interface EntryTileState {
  chipLabel: string;
  tone: "success" | "neutral";
  line: string;
}

export function getRewindEntryState(viewedThisSession: boolean): EntryTileState {
  return viewedThisSession
    ? { chipLabel: "Reviewed", tone: "success", line: "You've been through this week's review." }
    : { chipLabel: "Waiting", tone: "neutral", line: "This week's connected review is ready." };
}

export function getStrategyEntryState(strategyMoveStates: Record<string, "approved" | "dismissed">): EntryTileState {
  const decided = Object.keys(strategyMoveStates).length > 0;
  return decided
    ? { chipLabel: "Plan set", tone: "success", line: "You've acted on this week's focus plan." }
    : { chipLabel: "Waiting", tone: "neutral", line: "This week's focus plan is ready to review." };
}
