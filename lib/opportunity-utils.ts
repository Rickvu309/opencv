import type { ActivityMoment, AiSignal, FitLevel, NextAction, Nudge, Opportunity, Priority } from "@/lib/types";

// Shared read-only helpers for the Opportunities workspace: staleness,
// filtering, sorting, and the Focus strip's recommendation logic. Kept
// separate from lib/store/ so the workspace page and its views can stay
// thin and testable against plain data.

export const STALE_DAYS = 14;

export function daysBetween(fromDateIso: string, toDateIso: string): number {
  const from = new Date(fromDateIso).getTime();
  const to = new Date(toDateIso).getTime();
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

export function isStaleOpportunity(opportunity: Opportunity, todayIso: string): boolean {
  if (opportunity.status === "Closed") return false;
  return daysBetween(opportunity.lastActivityAt, todayIso) >= STALE_DAYS;
}

export function findSuggestedAction(
  opportunityId: string,
  nextActions: NextAction[]
): NextAction | undefined {
  return nextActions.find(
    (action) => action.opportunityId === opportunityId && action.state === "suggested"
  );
}

/**
 * Every activity moment for one opportunity, newest first, for the Activity
 * tab's vertical timeline.
 */
export function findOpportunityActivity(
  opportunityId: string,
  activityMoments: ActivityMoment[]
): ActivityMoment[] {
  return activityMoments
    .filter((moment) => moment.opportunityId === opportunityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The activity kinds Copilot itself produced, so the Activity tab and Home's what-changed digest tag exactly the same set with CopilotTag. */
export function isCopilotActivityKind(kind: ActivityMoment["kind"]): boolean {
  return kind === "copilot-analysis" || kind === "cv-tailored" || kind === "signal-accepted" || kind === "proof-added";
}

export function findPrimaryNextAction(
  opportunityId: string,
  nextActions: NextAction[]
): NextAction | undefined {
  const candidates = nextActions.filter((action) => action.opportunityId === opportunityId);
  return (
    candidates.find((action) => action.state === "suggested") ??
    candidates.find((action) => action.state === "accepted") ??
    candidates.find((action) => action.state === "done")
  );
}

/** How many of this opportunity's AiSignals are still awaiting a decision, backing the per-item signal glyph (section 4). */
export function countPendingSignals(opportunityId: string, aiSignals: AiSignal[]): number {
  return aiSignals.filter((signal) => signal.opportunityId === opportunityId && signal.state === "proposed").length;
}

export function needsAttention(
  opportunity: Opportunity,
  nextActions: NextAction[],
  todayIso: string
): boolean {
  return (
    isStaleOpportunity(opportunity, todayIso) ||
    Boolean(findSuggestedAction(opportunity.id, nextActions))
  );
}

/**
 * A Saved opportunity counts as "being worked" once one of its next actions
 * has moved past suggested (accepted or done), the same bar RDS-994's
 * Active/Watchlist split uses everywhere. Deliberately not "any next
 * action exists": a Saved item with only a suggested action is exactly the
 * "not yet started" case the Watchlist lens exists to hold.
 */
export function hasAcceptedNextAction(opportunityId: string, nextActions: NextAction[]): boolean {
  return nextActions.some(
    (action) =>
      action.opportunityId === opportunityId && (action.state === "accepted" || action.state === "done")
  );
}

/**
 * RDS-994's operating-model correction: the workspace is a lens over the
 * same store data, not a schema change. Active is the operational pipeline
 * Applied, Interview, and Offer always belong to it; Saved only joins once
 * it has an accepted next action, the same "being worked" bar
 * hasAcceptedNextAction defines. Closed belongs to neither lens, it lives
 * behind Active's own collapsed count chip.
 */
export function isActiveOpportunity(opportunity: Opportunity, nextActions: NextAction[]): boolean {
  if (opportunity.status === "Applied" || opportunity.status === "Interview" || opportunity.status === "Offer") {
    return true;
  }
  if (opportunity.status === "Saved") {
    return hasAcceptedNextAction(opportunity.id, nextActions);
  }
  return false;
}

/**
 * The complementary lens: Dream-flagged or Saved opportunities with no
 * active work yet, i.e. everything not already claimed by
 * isActiveOpportunity and not Closed. A Dream-flagged opportunity that
 * already has an accepted next action (opp-1 in seed data) is Active, not
 * Watchlist, the flag is a quality, not a queue.
 */
export function isWatchlistOpportunity(opportunity: Opportunity, nextActions: NextAction[]): boolean {
  if (opportunity.status === "Closed") return false;
  if (isActiveOpportunity(opportunity, nextActions)) return false;
  return opportunity.isDream || opportunity.status === "Saved";
}

/**
 * The Watchlist card/row's one "why it is here" line, built from the
 * object's own real fields (Dream flag, a suggested-but-not-accepted next
 * action, or plain Saved-with-nothing-queued) rather than a generic
 * placeholder, matching section 8's realism rule.
 */
export function buildWatchlistReason(opportunity: Opportunity, nextActions: NextAction[]): string {
  const suggested = findSuggestedAction(opportunity.id, nextActions);

  if (opportunity.isDream && suggested) {
    return `On your dream list, next up: ${suggested.verb.toLowerCase()}.`;
  }
  if (opportunity.isDream) {
    return "On your dream list, no next step queued yet.";
  }
  if (suggested) {
    return `Saved, Copilot suggests: ${suggested.verb.toLowerCase()}.`;
  }
  return "Saved with no next step suggested yet.";
}

/**
 * A Weak- or Unknown-fit opportunity that has moved past Saved (Applied,
 * Interview, or Offer) and so is still drawing real time and attention
 * despite the low fit read, as opposed to one still sitting untouched in
 * Saved. Backs the Strategy surface's "Low fit, still consuming effort"
 * segment (lib/strategy-utils.ts).
 */
export function isLowFitConsumingEffort(opportunity: Opportunity): boolean {
  return (
    (opportunity.fit === "Weak" || opportunity.fit === "Unknown") &&
    (opportunity.status === "Applied" || opportunity.status === "Interview" || opportunity.status === "Offer")
  );
}

const FIT_RANK: Record<FitLevel, number> = { Strong: 3, Medium: 2, Weak: 1, Unknown: 0 };
const PRIORITY_RANK: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };

export type OpportunitySort = "fit" | "priority" | "recently-active";

export function compareOpportunities(sort: OpportunitySort) {
  return (a: Opportunity, b: Opportunity): number => {
    switch (sort) {
      case "fit":
        return FIT_RANK[b.fit] - FIT_RANK[a.fit];
      case "priority":
        return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      case "recently-active":
      default:
        return b.lastActivityAt.localeCompare(a.lastActivityAt);
    }
  };
}

export type OpportunityFilter = "all" | "needs-attention" | "strong-fit" | "dream" | "low-fit-effort";

/** Every valid OpportunityFilter value, for validating a `filter` query param against (see /opportunities' Strategy deep-link sync). */
export const OPPORTUNITY_FILTER_VALUES: OpportunityFilter[] = [
  "all",
  "needs-attention",
  "strong-fit",
  "dream",
  "low-fit-effort",
];

export function matchesFilter(
  opportunity: Opportunity,
  filter: OpportunityFilter,
  nextActions: NextAction[],
  todayIso: string
): boolean {
  switch (filter) {
    case "needs-attention":
      return needsAttention(opportunity, nextActions, todayIso);
    case "strong-fit":
      return opportunity.fit === "Strong";
    case "dream":
      return opportunity.isDream;
    case "low-fit-effort":
      return isLowFitConsumingEffort(opportunity);
    case "all":
    default:
      return true;
  }
}

export interface DirectionAlignment {
  active: number;
  aligned: number;
}

/**
 * How many active (non-Closed) opportunities are linked to at least one
 * goal, read straight off seed alignment data (Opportunity.goalIds) so the
 * Goals direction band's alignment line never drifts from what's actually
 * linked on the Opportunities side.
 */
export function computeDirectionAlignment(opportunities: Opportunity[]): DirectionAlignment {
  const active = opportunities.filter((opportunity) => opportunity.status !== "Closed");
  const aligned = active.filter((opportunity) => (opportunity.goalIds?.length ?? 0) > 0);
  return { active: active.length, aligned: aligned.length };
}

export interface FocusItem {
  opportunityId: string;
  reason: string;
}

/**
 * Up to 3 opportunities Copilot recommends looking at now, each with a
 * one-line reason drawn from the opportunity's own suggested next action or
 * an active nudge already scripted for it. Ranked so an outstanding
 * suggested action outranks a high-potential flag, which outranks a plain
 * staleness call-out.
 */
export function getFocusItems(
  opportunities: Opportunity[],
  nextActions: NextAction[],
  nudges: Nudge[],
  todayIso: string
): FocusItem[] {
  const scored: { opportunity: Opportunity; reason: string; weight: number }[] = [];

  for (const opportunity of opportunities) {
    if (opportunity.status === "Closed") continue;

    const suggested = findSuggestedAction(opportunity.id, nextActions);
    if (suggested) {
      scored.push({ opportunity, reason: suggested.rationale, weight: 3 });
      continue;
    }

    const highPotential = nudges.find(
      (nudge) =>
        nudge.relatedOpportunityId === opportunity.id &&
        nudge.trigger === "high-potential" &&
        nudge.state === "active"
    );
    if (highPotential) {
      scored.push({ opportunity, reason: highPotential.message, weight: 2 });
      continue;
    }

    if (isStaleOpportunity(opportunity, todayIso)) {
      const staleNudge = nudges.find(
        (nudge) =>
          nudge.relatedOpportunityId === opportunity.id &&
          nudge.trigger === "stale-opportunity" &&
          nudge.state === "active"
      );
      const days = daysBetween(opportunity.lastActivityAt, todayIso);
      const reason =
        staleNudge?.message ??
        `No activity in ${days} days on this ${opportunity.fit.toLowerCase()}-fit opportunity, worth deciding whether to keep pursuing it.`;
      scored.push({ opportunity, reason, weight: 1 });
    }
  }

  return scored
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((entry) => ({ opportunityId: entry.opportunity.id, reason: entry.reason }));
}
