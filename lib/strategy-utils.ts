import { joinWithAnd } from "@/lib/comparison-utils";
import {
  daysBetween,
  findSuggestedAction,
  isLowFitConsumingEffort,
  isStaleOpportunity,
  needsAttention,
} from "@/lib/opportunity-utils";
import type { ConfidenceLevel, FitLevel, Goal, NextAction, Opportunity, Priority } from "@/lib/types";

// Read-only helpers behind the Strategy coaching surface (RDS-986, /strategy):
// the pipeline health summary, seeded strategic observations, the weekly
// focus plan's recommended moves, and the cluster segments, all computed
// live off real Opportunity/NextAction/Goal state, the same deterministic,
// parameterized-script pattern lib/opportunity-utils.ts's getFocusItems and
// lib/comparison-utils.ts's buildComparisonVerdicts already use. Kept
// separate from lib/store/ so the page and its cards stay thin and testable
// against plain data.

const FIT_RANK: Record<FitLevel, number> = { Strong: 3, Medium: 2, Weak: 1, Unknown: 0 };
const PRIORITY_RANK: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };
const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { High: 3, Medium: 2, Low: 1 };

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// 1. Pipeline health summary: one verdict line plus 3 compact indicators,
// each a share of active (non-Closed) opportunities. "Active" is
// status !== "Closed" throughout this file, matching lib/opportunity-utils.ts.
// ---------------------------------------------------------------------------

export type StrategyIndicatorState = "strong" | "adequate" | "weak";

export interface StrategyHealthIndicator {
  id: "strong-fit-coverage" | "momentum" | "effort-balance";
  label: string;
  displayValue: string;
  meterValue: number;
  state: StrategyIndicatorState;
  stateLabel: string;
  howJudged: string;
  /** The clause a "weak" verdict line names, "low-fit applications." */
  watchOutPhrase: string;
}

function tierFor(ratio: number): StrategyIndicatorState {
  if (ratio >= 0.5) return "strong";
  if (ratio >= 0.3) return "adequate";
  return "weak";
}

function meterValueFor(ratio: number): number {
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

export function buildStrongFitCoverageIndicator(opportunities: Opportunity[]): StrategyHealthIndicator {
  const active = opportunities.filter((opportunity) => opportunity.status !== "Closed");
  const strong = active.filter((opportunity) => opportunity.fit === "Strong");
  const ratio = active.length > 0 ? strong.length / active.length : 0;
  const state = tierFor(ratio);
  const stateLabel: Record<StrategyIndicatorState, string> = {
    strong: "Solid",
    adequate: "Building",
    weak: "Thin",
  };

  return {
    id: "strong-fit-coverage",
    label: "Strong-fit coverage",
    displayValue: `${strong.length} of ${active.length}`,
    meterValue: meterValueFor(ratio),
    state,
    stateLabel: stateLabel[state],
    howJudged: "Share of your active, non-closed opportunities Copilot currently rates Strong fit.",
    watchOutPhrase: "low-fit applications",
  };
}

export function buildMomentumIndicator(opportunities: Opportunity[], todayIso: string): StrategyHealthIndicator {
  const active = opportunities.filter((opportunity) => opportunity.status !== "Closed");
  const recent = active.filter((opportunity) => daysBetween(opportunity.lastActivityAt, todayIso) <= 7);
  const ratio = active.length > 0 ? recent.length / active.length : 0;
  const state = tierFor(ratio);
  const stateLabel: Record<StrategyIndicatorState, string> = {
    strong: "Active",
    adequate: "Steady",
    weak: "Slowing",
  };

  return {
    id: "momentum",
    label: "Momentum",
    displayValue: `${recent.length} of ${active.length}`,
    meterValue: meterValueFor(ratio),
    state,
    stateLabel: stateLabel[state],
    howJudged: "Share of active opportunities with a status change, note, or accepted action in the last 7 days.",
    watchOutPhrase: "opportunities that have gone quiet",
  };
}

export function buildEffortBalanceIndicator(
  opportunities: Opportunity[],
  nextActions: NextAction[]
): StrategyHealthIndicator {
  const investedActions = nextActions.filter((action) => action.state === "accepted" || action.state === "done");
  const highFit = investedActions.filter((action) => {
    const opportunity = opportunities.find((entry) => entry.id === action.opportunityId);
    return opportunity ? opportunity.fit === "Strong" || opportunity.fit === "Medium" : false;
  });
  const ratio = investedActions.length > 0 ? highFit.length / investedActions.length : 0;
  const state = tierFor(ratio);
  const stateLabel: Record<StrategyIndicatorState, string> = {
    strong: "Well balanced",
    adequate: "Mixed",
    weak: "Skewed low-fit",
  };

  return {
    id: "effort-balance",
    label: "Effort balance",
    displayValue: `${highFit.length} of ${investedActions.length}`,
    meterValue: meterValueFor(ratio),
    state,
    stateLabel: stateLabel[state],
    howJudged:
      "Share of accepted or completed next actions sitting on Strong- or Medium-fit opportunities, versus Weak or Unknown.",
    watchOutPhrase: "low-fit follow-through",
  };
}

export function buildHealthIndicators(
  opportunities: Opportunity[],
  nextActions: NextAction[],
  todayIso: string
): StrategyHealthIndicator[] {
  return [
    buildStrongFitCoverageIndicator(opportunities),
    buildMomentumIndicator(opportunities, todayIso),
    buildEffortBalanceIndicator(opportunities, nextActions),
  ];
}

/** One honest verdict line: names the weakest indicator's watch-out when one is genuinely thin, otherwise a plain healthy read. */
export function buildPipelineVerdict(indicators: StrategyHealthIndicator[]): string {
  if (indicators.length === 0) return "Not enough pipeline activity yet to read a verdict.";

  const rank: Record<StrategyIndicatorState, number> = { weak: 0, adequate: 1, strong: 2 };
  const weakest = indicators.reduce((worst, current) => (rank[current.state] < rank[worst.state] ? current : worst));

  if (weakest.state === "strong") {
    return "Your pipeline is healthy across every signal Copilot tracks this week.";
  }
  if (weakest.state === "weak") {
    return `Your pipeline is healthy overall, but overweight on ${weakest.watchOutPhrase}.`;
  }
  return `Your pipeline is healthy, with ${weakest.label.toLowerCase()} still building toward strong.`;
}

// ---------------------------------------------------------------------------
// 2. Key observations: up to 3 seeded strategic observations, each grounded
// in real store data with an evidence expand. Every builder honestly returns
// undefined when its pattern doesn't hold, rather than forcing content.
// ---------------------------------------------------------------------------

export interface StrategyObservation {
  id: string;
  pattern: string;
  whyItMatters: string;
  evidenceOpportunityIds: string[];
  hedge?: string;
}

function buildCredibilityPriorityObservation(
  opportunities: Opportunity[],
  todayIso: string
): StrategyObservation | undefined {
  const flagged = opportunities
    .filter(
      (opportunity) =>
        opportunity.status !== "Closed" && opportunity.hasCredibilityFlag && opportunity.priority !== "Low"
    )
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  const target = flagged[0];
  if (!target) return undefined;

  const days = daysBetween(target.lastActivityAt, todayIso);
  return {
    id: "observation-credibility-priority",
    pattern: `${target.company} is still ${target.priority} priority despite a failed credibility check.`,
    whyItMatters: `Priority isn't matching risk here, ${days} days have passed with nothing verified yet.`,
    evidenceOpportunityIds: [target.id],
  };
}

function buildConvergingDecisionsObservation(opportunities: Opportunity[]): StrategyObservation | undefined {
  const live = opportunities.filter(
    (opportunity) => opportunity.status === "Interview" || opportunity.status === "Offer"
  );
  if (live.length < 2) return undefined;

  const names = joinWithAnd(live.map((opportunity) => opportunity.company));
  return {
    id: "observation-converging-decisions",
    pattern: `${live.length} live decision points, ${names}, are active at the same time.`,
    whyItMatters: "Each needs real prep or review time; worth sequencing rather than letting one crowd out another.",
    evidenceOpportunityIds: live.map((opportunity) => opportunity.id),
    hedge: "Based on currently scheduled stages, worth confirming timing hasn't shifted since.",
  };
}

function buildStalledApplicationObservation(
  opportunities: Opportunity[],
  todayIso: string
): StrategyObservation | undefined {
  const stalled = opportunities
    .filter(
      (opportunity) =>
        isLowFitConsumingEffort(opportunity) && isStaleOpportunity(opportunity, todayIso)
    )
    .sort((a, b) => daysBetween(b.lastActivityAt, todayIso) - daysBetween(a.lastActivityAt, todayIso));
  const target = stalled[0];
  if (!target) return undefined;

  const days = daysBetween(target.lastActivityAt, todayIso);
  return {
    id: "observation-stalled-application",
    pattern: `${target.company} has sat in ${target.status} for ${days} days with a ${target.fit.toLowerCase()} fit.`,
    whyItMatters: "Consuming a pipeline slot without moving is worth a clean decision instead of a quiet drift.",
    evidenceOpportunityIds: [target.id],
  };
}

function buildStaleSavedObservation(
  opportunities: Opportunity[],
  todayIso: string
): StrategyObservation | undefined {
  const staleSaved = opportunities
    .filter((opportunity) => opportunity.status === "Saved" && isStaleOpportunity(opportunity, todayIso))
    .sort((a, b) => daysBetween(b.lastActivityAt, todayIso) - daysBetween(a.lastActivityAt, todayIso));
  const target = staleSaved[0];
  if (!target) return undefined;

  const days = daysBetween(target.lastActivityAt, todayIso);
  return {
    id: "observation-stale-saved",
    pattern: `${target.company} has sat in Saved for ${days} days with no update.`,
    whyItMatters: "Saved opportunities that go longest without an update are the easiest ones to lose track of.",
    evidenceOpportunityIds: [target.id],
    hedge: staleSaved.length === 1 ? "The only saved opportunity currently this quiet." : undefined,
  };
}

/** Up to 3 observations, honestly fewer when a pattern's signal is too thin to name. */
export function buildStrategyObservations(
  opportunities: Opportunity[],
  todayIso: string
): StrategyObservation[] {
  const candidates = [
    buildCredibilityPriorityObservation(opportunities, todayIso),
    buildConvergingDecisionsObservation(opportunities),
    buildStalledApplicationObservation(opportunities, todayIso),
    buildStaleSavedObservation(opportunities, todayIso),
  ].filter((observation): observation is StrategyObservation => Boolean(observation));

  return candidates.slice(0, 3);
}

// ---------------------------------------------------------------------------
// 3. Weekly focus plan: up to 4 five-beat acceptable recommendations, each
// grounded in a real opportunity and, where relevant, a real suggested next
// action. Ranking excludes ids already used by an earlier slot so the 4
// moves never target the same opportunity twice.
// ---------------------------------------------------------------------------

export type StrategyMoveKind = "focus" | "deprioritize" | "invest" | "pursue-more";

export interface StrategyMove {
  /** Stable per-slot id ("strategy-focus", "strategy-invest", ...), independent of which candidate currently fills the slot, so approve/dismiss state survives an Adjust swap. */
  id: string;
  kind: StrategyMoveKind;
  opportunityId?: string;
  /** Present on focus and invest: the specific suggested next action Approve accepts. */
  nextActionId?: string;
  /** Present on deprioritize: logged verbatim to the opportunity's Activity on Approve. */
  reasoning?: string;
  /** Present on pursue-more: the one-line guidance shown in place of a target opportunity. */
  guidance?: string;
  move: string;
  expectedEffect: string;
}

interface FocusCandidate {
  opportunity: Opportunity;
  action: NextAction;
}

function rankFocusCandidates(
  opportunities: Opportunity[],
  nextActions: NextAction[],
  excludeIds: Set<string>
): FocusCandidate[] {
  return opportunities
    .filter((opportunity) => opportunity.status !== "Closed" && !excludeIds.has(opportunity.id))
    .map((opportunity) => ({ opportunity, action: findSuggestedAction(opportunity.id, nextActions) }))
    .filter((entry): entry is FocusCandidate => Boolean(entry.action))
    .sort((a, b) => {
      const fitDiff = FIT_RANK[b.opportunity.fit] - FIT_RANK[a.opportunity.fit];
      if (fitDiff !== 0) return fitDiff;
      const confidenceDiff = CONFIDENCE_RANK[b.action.confidence] - CONFIDENCE_RANK[a.action.confidence];
      if (confidenceDiff !== 0) return confidenceDiff;
      const priorityDiff = PRIORITY_RANK[b.opportunity.priority] - PRIORITY_RANK[a.opportunity.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.opportunity.company.localeCompare(b.opportunity.company);
    });
}

function rankDeprioritizeCandidates(opportunities: Opportunity[], excludeIds: Set<string>): Opportunity[] {
  return opportunities
    .filter(
      (opportunity) =>
        opportunity.status !== "Closed" &&
        opportunity.priority !== "Low" &&
        !excludeIds.has(opportunity.id) &&
        (opportunity.fit === "Weak" || opportunity.fit === "Unknown")
    )
    .sort((a, b) => {
      const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const flagDiff = Number(b.hasCredibilityFlag ?? false) - Number(a.hasCredibilityFlag ?? false);
      if (flagDiff !== 0) return flagDiff;
      return a.company.localeCompare(b.company);
    });
}

export function buildFocusMove(opportunity: Opportunity, action: NextAction): StrategyMove {
  return {
    id: "strategy-focus",
    kind: "focus",
    opportunityId: opportunity.id,
    nextActionId: action.id,
    move: `Focus on ${opportunity.company} this week`,
    expectedEffect: `Pins "${action.verb}" to the top of Home's next actions (${action.dueHint}).`,
  };
}

export function buildInvestMove(opportunity: Opportunity, action: NextAction): StrategyMove {
  return {
    id: "strategy-invest",
    kind: "invest",
    opportunityId: opportunity.id,
    nextActionId: action.id,
    move: `Invest the follow-up in ${opportunity.company}`,
    expectedEffect: `Accepts "${action.verb}" (${action.effort}), keeping momentum on a ${opportunity.fit.toLowerCase()}-fit opportunity.`,
  };
}

export function buildDeprioritizeMove(opportunity: Opportunity, todayIso: string): StrategyMove {
  const days = daysBetween(opportunity.lastActivityAt, todayIso);
  const reasonParts: string[] = [];
  if (opportunity.hasCredibilityFlag) reasonParts.push("its credibility check failed");
  reasonParts.push(`there's been no movement in ${days} day${days === 1 ? "" : "s"}`);

  return {
    id: "strategy-deprioritize",
    kind: "deprioritize",
    opportunityId: opportunity.id,
    reasoning: `${capitalize(joinWithAnd(reasonParts))}, priority should reflect that until it clears.`,
    move: `Deprioritize ${opportunity.company} to Low`,
    expectedEffect: "Stops it competing for attention against your verified Strong-fit pipeline.",
  };
}

function buildPursueMoreMove(opportunities: Opportunity[], goals: Goal[]): StrategyMove {
  const active = opportunities.filter((opportunity) => opportunity.status !== "Closed");
  const counts = goals.map((goal) => ({
    goal,
    linked: active.filter((opportunity) => (opportunity.goalIds ?? []).includes(goal.id)),
  }));
  const weakest =
    counts.length > 0 ? counts.reduce((worst, current) => (current.linked.length < worst.linked.length ? current : worst)) : undefined;

  const guidance = weakest
    ? weakest.linked.length === 0
      ? `No active opportunity is currently pulling for "${weakest.goal.title}"; a fresh one in that direction would keep it moving.`
      : `Only ${joinWithAnd(weakest.linked.map((opportunity) => opportunity.company))} ${
          weakest.linked.length === 1 ? "is" : "are"
        } pulling for "${weakest.goal.title}"; a fresh opportunity there would keep it from riding on one outcome.`
    : "Add a fresh opportunity that clearly matches your target direction to keep the pipeline moving.";

  return {
    id: "strategy-pursue-more",
    kind: "pursue-more",
    guidance,
    move: "Add one more opportunity",
    expectedEffect: "Broadens coverage on the goal getting the least support from your current pipeline.",
  };
}

/**
 * Up to 4 moves: focus, invest, deprioritize, then the always-present
 * pursue-more guidance. Intended to be computed once per session (see
 * WeeklyFocusPlan's lazy useState) so the plan reads as set for the week
 * rather than reshuffling every time an earlier move's approval changes the
 * data it was ranked from.
 */
export function buildWeeklyFocusPlan(
  opportunities: Opportunity[],
  nextActions: NextAction[],
  goals: Goal[],
  todayIso: string
): StrategyMove[] {
  const moves: StrategyMove[] = [];
  const used = new Set<string>();

  const focusCandidate = rankFocusCandidates(opportunities, nextActions, used)[0];
  if (focusCandidate) {
    moves.push(buildFocusMove(focusCandidate.opportunity, focusCandidate.action));
    used.add(focusCandidate.opportunity.id);
  }

  const investCandidate = rankFocusCandidates(opportunities, nextActions, used)[0];
  if (investCandidate) {
    moves.push(buildInvestMove(investCandidate.opportunity, investCandidate.action));
    used.add(investCandidate.opportunity.id);
  }

  const deprioritizeCandidate = rankDeprioritizeCandidates(opportunities, used)[0];
  if (deprioritizeCandidate) {
    moves.push(buildDeprioritizeMove(deprioritizeCandidate, todayIso));
    used.add(deprioritizeCandidate.id);
  }

  moves.push(buildPursueMoreMove(opportunities, goals));

  return moves.slice(0, 4);
}

/** The Adjust control's one alternative for a focus or invest slot, excluding whichever ids the rest of the plan (plus the slot's own current target) already use. */
export function buildAdjustCandidate(
  kind: "focus" | "invest",
  opportunities: Opportunity[],
  nextActions: NextAction[],
  excludeOpportunityIds: string[]
): FocusCandidate | undefined {
  return rankFocusCandidates(opportunities, nextActions, new Set(excludeOpportunityIds))[0];
}

/** The Adjust control's one alternative for the deprioritize slot, same exclusion rule as buildAdjustCandidate. */
export function buildAdjustDeprioritizeCandidate(
  opportunities: Opportunity[],
  excludeOpportunityIds: string[]
): Opportunity | undefined {
  return rankDeprioritizeCandidates(opportunities, new Set(excludeOpportunityIds))[0];
}

// ---------------------------------------------------------------------------
// 4. Cluster drill-down: 3 segments as clickable counts into /opportunities,
// plus how many strong-fit-active ids the "Compare the top candidates"
// shortcut can preselect.
// ---------------------------------------------------------------------------

export interface StrategySegments {
  strongFitActive: Opportunity[];
  staleOrDrifting: Opportunity[];
  lowFitEffort: Opportunity[];
}

export function buildStrategySegments(
  opportunities: Opportunity[],
  nextActions: NextAction[],
  todayIso: string
): StrategySegments {
  return {
    strongFitActive: opportunities.filter(
      (opportunity) => opportunity.status !== "Closed" && opportunity.fit === "Strong"
    ),
    staleOrDrifting: opportunities.filter((opportunity) => needsAttention(opportunity, nextActions, todayIso)),
    lowFitEffort: opportunities.filter((opportunity) => isLowFitConsumingEffort(opportunity)),
  };
}
