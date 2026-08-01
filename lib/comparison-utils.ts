import { findPrimaryNextAction } from "@/lib/opportunity-utils";
import type {
  AiInsight,
  ComparisonTone,
  CredibilityInsight,
  FitInsight,
  FitLevel,
  Goal,
  NextAction,
  Opportunity,
  OpportunityComparisonProfile,
  Priority,
} from "@/lib/types";

// Read-only helpers behind the /opportunities/compare decision workspace
// (RDS-985): selection bounds, the dimension grid's row definitions, and the
// deterministic generators behind the tradeoffs strip and the Copilot
// verdict cards. Every generator here is a fixed, parameterized script, the
// same pattern lib/opportunity-utils.ts's getFocusItems already uses to
// template a reason string from real seed fields, never free text.

export const MIN_COMPARISON = 2;
export const MAX_COMPARISON = 4;

/** The dimension grid's row-label gutter width, shared with the pinned header cards row above it so both stay column-aligned. */
export const COMPARISON_LABEL_GUTTER = "12rem";

/** One grid-template-columns string shared by the pinned header cards and the dimension grid, so a candidate's column lines up top to bottom. */
export function comparisonGridTemplate(candidateCount: number): string {
  return `${COMPARISON_LABEL_GUTTER} repeat(${candidateCount}, minmax(0, 1fr))`;
}

export type ComparisonDimensionId =
  | "fit"
  | "goal-alignment"
  | "growth-potential"
  | "timing"
  | "risk"
  | "preparation-effort";

/** The 3 pairs the grid chunks its 6 rows into (Miller's Law): a dense flat list of 6 reads as more to hold at once than 3 named pairs of 2. */
export type ComparisonDimensionGroup = "How it fits" | "Momentum" | "Watch for";

export interface ComparisonDimensionDef {
  id: ComparisonDimensionId;
  label: string;
  group: ComparisonDimensionGroup;
  /** The info affordance's "how this is judged" text, Progressive Disclosure behind each row. */
  methodology: string;
}

// Priority order per the brief: Fit, Goal alignment, Growth potential,
// Timing, Risk and unknowns, Preparation effort.
export const COMPARISON_DIMENSIONS: ComparisonDimensionDef[] = [
  {
    id: "fit",
    label: "Fit",
    group: "How it fits",
    methodology:
      "Pulled straight from this opportunity's own AI Analysis fit judgment, Strong, Medium, Weak, or Unknown, unchanged from what its detail page already says.",
  },
  {
    id: "goal-alignment",
    label: "Goal alignment",
    group: "How it fits",
    methodology:
      "Whether the opportunity is linked to one of your active goals. A link means its fit analysis or notes name that goal directly, not a guess made for this view.",
  },
  {
    id: "growth-potential",
    label: "Growth potential",
    group: "Momentum",
    methodology:
      "How much room this specific role has to deepen your target direction over the next year, weighed against the scope, team, and company stage described in the listing.",
  },
  {
    id: "timing",
    label: "Timing",
    group: "Momentum",
    methodology:
      "Where the opportunity sits in its pipeline stage and how much momentum it currently has, drawn from its status and how recently something moved on it.",
  },
  {
    id: "risk",
    label: "Risk and unknowns",
    group: "Watch for",
    methodology:
      "What's still unverified: credibility signals, open questions from the fit judgment, and anything the process hasn't tested yet.",
  },
  {
    id: "preparation-effort",
    label: "Preparation effort",
    group: "Watch for",
    methodology:
      "How much work stands between here and your next real decision: a case study to send, a CV to tailor, a credibility check to clear.",
  },
];

export function isValidComparisonSelection(ids: string[], opportunities: Opportunity[]): boolean {
  if (ids.length < MIN_COMPARISON || ids.length > MAX_COMPARISON) return false;
  const unique = new Set(ids);
  if (unique.size !== ids.length) return false;
  return ids.every((id) => opportunities.some((opportunity) => opportunity.id === id));
}

export function getComparisonProfile(
  opportunityId: string,
  profiles: OpportunityComparisonProfile[]
): OpportunityComparisonProfile | undefined {
  return profiles.find((profile) => profile.opportunityId === opportunityId);
}

export function shortCompanyName(company: string): string {
  return company.split(" ")[0];
}

const FIT_RANK: Record<FitLevel, number> = { Strong: 3, Medium: 2, Weak: 1, Unknown: 0 };
const TONE_RANK: Record<ComparisonTone, number> = { danger: 0, muted: 1, warning: 2, neutral: 2, success: 3 };
const PRIORITY_RANK: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };

function findFitInsight(opportunityId: string, insights: AiInsight[]): FitInsight | undefined {
  return insights.find(
    (insight): insight is FitInsight => insight.kind === "fit" && insight.hostId === opportunityId
  );
}

/**
 * Deliberately stays to one or two words: a full goal title can run long
 * enough to overflow a compact grid cell, and this dimension's job is to
 * answer "linked or not," not to repeat the goal's own title (the detail
 * page's Related goal card already shows that in full).
 */
export function goalAlignmentLabel(opportunity: Opportunity, goals: Goal[]): { tone: ComparisonTone; label: string } {
  const linked = (opportunity.goalIds ?? [])
    .map((id) => goals.find((goal) => goal.id === id))
    .filter((goal): goal is Goal => Boolean(goal));
  if (linked.length === 0) return { tone: "muted", label: "Not linked" };
  if (linked.length === 1) return { tone: "success", label: "Linked to 1 goal" };
  return { tone: "success", label: `Linked to ${linked.length} goals` };
}

// ---------------------------------------------------------------------------
// Tradeoffs strip: one clause per candidate ("{Company} {strength}, but
// {caveat}."), picking the up-to-3 most differentiated candidates when 4 are
// selected so the strip stays within the 2-to-3-line budget.
// ---------------------------------------------------------------------------

function candidateProfileVector(
  opportunity: Opportunity,
  profile: OpportunityComparisonProfile,
  insights: AiInsight[]
): number[] {
  const fitInsight = findFitInsight(opportunity.id, insights);
  return [
    FIT_RANK[fitInsight?.level ?? opportunity.fit],
    TONE_RANK[profile.growthPotential.tone],
    TONE_RANK[profile.timing.tone],
    TONE_RANK[profile.risk.tone],
    TONE_RANK[profile.preparationEffort.tone],
  ];
}

/** Sum of |this candidate's rank - the mean of the others' rank| across every axis, how much this candidate stands out from the rest of the selection. */
function distinctiveness(index: number, vectors: number[][]): number {
  const others = vectors.filter((_, otherIndex) => otherIndex !== index);
  if (others.length === 0) return 0;
  const target = vectors[index];
  return target.reduce((sum, value, axis) => {
    const othersMean = others.reduce((total, vector) => total + vector[axis], 0) / others.length;
    return sum + Math.abs(value - othersMean);
  }, 0);
}

export function buildTradeoffLines(
  selected: Opportunity[],
  profiles: OpportunityComparisonProfile[],
  insights: AiInsight[]
): string[] {
  const withProfiles = selected
    .map((opportunity) => ({ opportunity, profile: getComparisonProfile(opportunity.id, profiles) }))
    .filter((entry): entry is { opportunity: Opportunity; profile: OpportunityComparisonProfile } =>
      Boolean(entry.profile)
    );

  let chosen = withProfiles;
  if (withProfiles.length > 3) {
    const vectors = withProfiles.map((entry) => candidateProfileVector(entry.opportunity, entry.profile, insights));
    const scored = withProfiles
      .map((entry, index) => ({ entry, score: distinctiveness(index, vectors) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    chosen = scored.map((item) => item.entry);
  }

  return chosen.map(
    ({ opportunity, profile }) =>
      `${shortCompanyName(opportunity.company)} ${profile.tradeoffHighlight.strength}, but ${profile.tradeoffHighlight.caveat}.`
  );
}

// ---------------------------------------------------------------------------
// Copilot decision layer: up to 3 verdicts (Best for now, Best long-term
// upside, Safest), computed from the same structured judgments the grid
// renders, merged into one card when two verdicts pick the same candidate.
// ---------------------------------------------------------------------------

export type VerdictKind = "best-for-now" | "best-long-term" | "safest";

export const VERDICT_LABELS: Record<VerdictKind, string> = {
  "best-for-now": "Best for now",
  "best-long-term": "Best long-term upside",
  safest: "Safest",
};

export interface ComparisonVerdictCard {
  opportunityId: string;
  kinds: VerdictKind[];
  why: string;
  confidence: "High" | "Medium" | "Low";
}

function pickWinner(
  selected: Opportunity[],
  score: (opportunity: Opportunity) => number
): Opportunity {
  return [...selected].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.company.localeCompare(b.company);
  })[0];
}

export function buildComparisonVerdicts(
  selected: Opportunity[],
  profiles: OpportunityComparisonProfile[],
  insights: AiInsight[],
  nextActions: NextAction[]
): ComparisonVerdictCard[] {
  const profileFor = (opportunity: Opportunity) => getComparisonProfile(opportunity.id, profiles);

  const bestForNowWinner = pickWinner(selected, (opportunity) => {
    const profile = profileFor(opportunity);
    if (!profile) return -1;
    return TONE_RANK[profile.timing.tone] * 2 + TONE_RANK[profile.preparationEffort.tone];
  });

  const bestLongTermWinner = pickWinner(selected, (opportunity) => {
    const profile = profileFor(opportunity);
    const fitInsight = findFitInsight(opportunity.id, insights);
    const fitRank = FIT_RANK[fitInsight?.level ?? opportunity.fit];
    const goalBonus = (opportunity.goalIds?.length ?? 0) > 0 ? 1 : 0;
    return fitRank * 2 + (profile ? TONE_RANK[profile.growthPotential.tone] * 2 : 0) + goalBonus;
  });

  const safestWinner = pickWinner(selected, (opportunity) => {
    const profile = profileFor(opportunity);
    const flagPenalty = opportunity.hasCredibilityFlag ? -4 : 0;
    return (profile ? TONE_RANK[profile.risk.tone] * 2 : 0) + flagPenalty;
  });

  function confidenceFor(kind: VerdictKind, opportunity: Opportunity): "High" | "Medium" | "Low" {
    if (kind === "best-for-now") {
      const primaryAction = findPrimaryNextAction(opportunity.id, nextActions);
      return primaryAction?.confidence ?? "Medium";
    }
    if (kind === "best-long-term") {
      const fitInsight = findFitInsight(opportunity.id, insights);
      return fitInsight?.confidence ?? "Medium";
    }
    if (opportunity.hasCredibilityFlag) return "Low";
    const fitInsight = findFitInsight(opportunity.id, insights);
    return fitInsight?.confidence ?? "Medium";
  }

  const verdictOrder: { kind: VerdictKind; winner: Opportunity }[] = [
    { kind: "best-for-now", winner: bestForNowWinner },
    { kind: "best-long-term", winner: bestLongTermWinner },
    { kind: "safest", winner: safestWinner },
  ];

  const cards: ComparisonVerdictCard[] = [];
  for (const { kind, winner } of verdictOrder) {
    const existing = cards.find((card) => card.opportunityId === winner.id);
    if (existing) {
      existing.kinds.push(kind);
      continue;
    }
    const profile = profileFor(winner);
    const reasonKey = kind === "best-for-now" ? "bestForNow" : kind === "best-long-term" ? "bestLongTerm" : "safest";
    cards.push({
      opportunityId: winner.id,
      kinds: [kind],
      why: profile?.verdictReasons[reasonKey] ?? "Copilot hasn't judged this candidate on this dimension yet.",
      confidence: confidenceFor(kind, winner),
    });
  }

  return cards;
}

/**
 * The verdict card's expandable reasoning: real per-object AI Analysis
 * content grounding whichever axis that verdict is actually about, rather
 * than repeating the card's own two-line why. Best for now digs into the
 * primary next action's own rationale, Best long-term upside into the fit
 * judgment's reasoning, Safest into the credibility check's reasoning.
 */
export function buildVerdictExpandedReasoning(
  kind: VerdictKind,
  opportunity: Opportunity,
  insights: AiInsight[],
  nextActions: NextAction[]
): string {
  if (kind === "best-for-now") {
    const primaryAction = findPrimaryNextAction(opportunity.id, nextActions);
    return primaryAction?.rationale ?? "No next action queued yet, so there's nothing pulling this forward right now.";
  }
  if (kind === "best-long-term") {
    const fitInsight = findFitInsight(opportunity.id, insights);
    return fitInsight?.whyThisReading ?? "Fit hasn't been fully judged for this opportunity yet.";
  }
  const credibilityInsight = insights.find(
    (insight): insight is CredibilityInsight => insight.kind === "credibility" && insight.hostId === opportunity.id
  );
  return credibilityInsight?.whyThisReading ?? "This opportunity hasn't been credibility-checked yet.";
}

/** One honest line on what could change the verdicts: the "Best for now" winner's own next action already names what would change its advice. */
export function buildWhatCouldChangeVerdicts(
  selected: Opportunity[],
  verdicts: ComparisonVerdictCard[],
  nextActions: NextAction[]
): string {
  const bestForNowCard = verdicts.find((card) => card.kinds.includes("best-for-now"));
  const ordered = bestForNowCard
    ? [bestForNowCard.opportunityId, ...selected.map((opportunity) => opportunity.id)]
    : selected.map((opportunity) => opportunity.id);

  for (const opportunityId of ordered) {
    const opportunity = selected.find((entry) => entry.id === opportunityId);
    if (!opportunity) continue;
    const primaryAction = findPrimaryNextAction(opportunity.id, nextActions);
    if (primaryAction?.whatWouldChangeThis) return primaryAction.whatWouldChangeThis;
  }

  return "This reading could change once Copilot has run a full analysis on every candidate here.";
}

/**
 * The "Make this my focus" save-back confirmation's message: names exactly
 * what changed, never a generic "Done." A priority already at High, or a
 * candidate with no next action to pin, both honestly drop that clause
 * instead of claiming a change that didn't happen.
 */
export function buildFocusConfirmationMessage(
  opportunity: Opportunity,
  changed: { priorityChanged: boolean; nextActionPinned: boolean }
): string {
  const clauses: string[] = [];
  if (changed.priorityChanged) clauses.push("priority set to High");
  if (changed.nextActionPinned) clauses.push("its next action pinned to Home");
  clauses.push("logged in Activity");

  return `${opportunity.role} at ${opportunity.company} is now your focus: ${joinWithAnd(clauses)}.`;
}

/** Join company-style labels the way this app's copy already reads: "X", "X and Y", or "X, Y, and Z". */
export function joinWithAnd(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}
