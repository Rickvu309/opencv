import type { FitLevel, NextAction, Nudge, Opportunity, Priority } from "@/lib/types";

// Shared read-only helpers for the Opportunities workspace: staleness,
// filtering, sorting, and the Focus strip's recommendation logic. Kept
// separate from lib/store.tsx so the workspace page and its views can stay
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

export type OpportunityFilter = "all" | "needs-attention" | "strong-fit" | "dream";

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
    case "all":
    default:
      return true;
  }
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
