import { daysBetween } from "@/lib/opportunity-utils";
import type { ChipTone } from "@/components/shared/chip-tones";
import type {
  RecruiterCandidate,
  RecruiterDecisionCall,
  RecruiterReadiness,
  RecruiterRole,
  RecruiterSource,
  RecruiterStage,
} from "@/lib/types";

// Shared read-only helpers for recruiter mode: staleness, stage sequencing,
// filtering, sorting, and the pipeline's "Needs attention" strip. Mirrors
// lib/opportunity-utils.ts's shape (the candidate-side workspace's own set
// of computed-live helpers) so the two persona modes read as the same kind
// of product under the hood, per Jakob's Law, even though the domains never
// share state.

/** Every stage, board-column order. */
export const RECRUITER_STAGES: RecruiterStage[] = ["Sourced", "Screening", "Interview", "Offer", "Hired", "Closed"];

/** Stages a candidate can still be actively moving through; Hired and Closed are resting states. */
const ACTIVE_STAGES: RecruiterStage[] = ["Sourced", "Screening", "Interview", "Offer"];

/** Past this many days in the same stage, a card shows a stale dot regardless of its seeded readiness. */
export const RECRUITER_STALE_DAYS_IN_STAGE = 7;

export function daysInStage(candidate: RecruiterCandidate, todayIso: string): number {
  return daysBetween(candidate.stageEnteredAt, todayIso);
}

export function isStaleInStage(candidate: RecruiterCandidate, todayIso: string): boolean {
  if (!ACTIVE_STAGES.includes(candidate.stage)) return false;
  return daysInStage(candidate, todayIso) >= RECRUITER_STALE_DAYS_IN_STAGE;
}

/** The next stage forward in the pipeline, or undefined once a candidate is Hired or Closed (nothing to advance to). */
export function nextRecruiterStage(stage: RecruiterStage): RecruiterStage | undefined {
  if (stage === "Hired" || stage === "Closed") return undefined;
  const index = RECRUITER_STAGES.indexOf(stage);
  return RECRUITER_STAGES[index + 1];
}

const READINESS_TONE: Record<RecruiterReadiness, ChipTone> = {
  "Ready to advance": "success",
  "Needs review": "warning",
  Blocked: "danger",
  // "stale-but-not-failed" is docs/design.md's own documented warning
  // semantic, the same tone Needs review uses; the label text still tells
  // the two apart.
  Stale: "warning",
};

export function recruiterReadinessTone(readiness: RecruiterReadiness): ChipTone {
  return READINESS_TONE[readiness];
}

const SOURCE_LABEL: Record<RecruiterSource, string> = {
  Referral: "Referral",
  Inbound: "Inbound",
  Sourced: "Sourced",
};

export function recruiterSourceLabel(source: RecruiterSource): string {
  return SOURCE_LABEL[source];
}

export function findRecruiterRole(roleId: string, roles: RecruiterRole[]): RecruiterRole | undefined {
  return roles.find((role) => role.id === roleId);
}

export function candidatesForRole(roleId: string, candidates: RecruiterCandidate[]): RecruiterCandidate[] {
  return candidates.filter((candidate) => candidate.roleId === roleId);
}

export interface RecruiterAttentionItem {
  candidateId: string;
  reason: string;
}

/**
 * Up to 3 Copilot-flagged candidates for the pipeline's "Needs attention"
 * strip. Which candidates qualify is seeded (RecruiterCandidate.attentionTemplate,
 * capped at 3 in the seed data itself, the same "computed live off a capped
 * seed" split docs/architecture.md's Strategy and Proof Builder entries use
 * elsewhere), but the day count inside each reason is always computed live
 * off stageEnteredAt so it can never drift from the same figure the card
 * itself renders. RDS-989: a candidate with an open (not done) follow-up
 * task, from a Request-more-info decision, shows that live reason instead
 * of the static seeded one, since it's the most current, recruiter-confirmed
 * next step; a candidate with neither is skipped, same as before.
 */
export function getRecruiterAttentionItems(candidates: RecruiterCandidate[], todayIso: string): RecruiterAttentionItem[] {
  const items: RecruiterAttentionItem[] = [];
  for (const candidate of candidates) {
    const openTask = candidate.followUpTasks?.find((task) => !task.done);
    if (openTask) {
      items.push({ candidateId: candidate.id, reason: `Follow-up: ${openTask.label}` });
    } else if (candidate.attentionTemplate) {
      items.push({ candidateId: candidate.id, reason: candidate.attentionTemplate.replace("{days}", String(daysInStage(candidate, todayIso))) });
    }
  }
  return items.slice(0, 3);
}

export type RecruiterReadinessFilter = "all" | RecruiterReadiness;
export type RecruiterSourceFilter = "all" | RecruiterSource;
export type RecruiterRoleFilter = "all" | string;

export function matchesRecruiterFilters(
  candidate: RecruiterCandidate,
  filters: { role: RecruiterRoleFilter; readiness: RecruiterReadinessFilter; source: RecruiterSourceFilter }
): boolean {
  if (filters.role !== "all" && candidate.roleId !== filters.role) return false;
  if (filters.readiness !== "all" && candidate.readiness !== filters.readiness) return false;
  if (filters.source !== "all" && candidate.source !== filters.source) return false;
  return true;
}

export type RecruiterCandidateSort = "days-in-stage" | "readiness";

const READINESS_RANK: Record<RecruiterReadiness, number> = {
  Blocked: 3,
  Stale: 2,
  "Needs review": 1,
  "Ready to advance": 0,
};

export function compareRecruiterCandidates(sort: RecruiterCandidateSort, todayIso: string) {
  return (a: RecruiterCandidate, b: RecruiterCandidate): number => {
    if (sort === "readiness") {
      return READINESS_RANK[b.readiness] - READINESS_RANK[a.readiness];
    }
    return daysInStage(b, todayIso) - daysInStage(a, todayIso);
  };
}

export interface RecruiterRoleSummary {
  role: RecruiterRole;
  candidateCount: number;
  stageCounts: Record<RecruiterStage, number>;
  daysOpen: number;
  topWaitingCandidate?: RecruiterCandidate;
}

/**
 * The Roles index's one summary per role: stage counts, how long it's been
 * open, and the single candidate who's waited longest in an active stage
 * (ties broken toward whichever needs the most attention), so "top waiting
 * candidate" always means something concrete, never just "first in the
 * list."
 */
export function summarizeRecruiterRole(role: RecruiterRole, candidates: RecruiterCandidate[], todayIso: string): RecruiterRoleSummary {
  const roleCandidates = candidatesForRole(role.id, candidates);
  const stageCounts = RECRUITER_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = roleCandidates.filter((candidate) => candidate.stage === stage).length;
      return acc;
    },
    {} as Record<RecruiterStage, number>
  );

  const waiting = roleCandidates.filter((candidate) => ACTIVE_STAGES.includes(candidate.stage));
  const topWaitingCandidate = [...waiting].sort((a, b) => {
    const readinessDelta = READINESS_RANK[b.readiness] - READINESS_RANK[a.readiness];
    if (readinessDelta !== 0) return readinessDelta;
    return daysInStage(b, todayIso) - daysInStage(a, todayIso);
  })[0];

  return {
    role,
    candidateCount: roleCandidates.length,
    stageCounts,
    daysOpen: daysBetween(role.openedAt, todayIso),
    topWaitingCandidate,
  };
}

// ---------------------------------------------------------------------------
// Decision layer (RDS-989)
// ---------------------------------------------------------------------------

/** Fixed display order for the decision block's recommended-plus-secondary calls. */
export const RECRUITER_DECISION_CALLS: RecruiterDecisionCall[] = ["advance", "hold", "request-info", "do-not-advance"];

/** The label a decision call renders as, "advance" always naming the actual next stage. */
export function decisionCallLabel(call: RecruiterDecisionCall, candidate: RecruiterCandidate): string {
  switch (call) {
    case "advance": {
      const next = nextRecruiterStage(candidate.stage);
      return next ? `Advance to ${next}` : "Advance";
    }
    case "hold":
      return "Hold";
    case "request-info":
      return "Request more info";
    case "do-not-advance":
      return "Do not advance";
  }
}

/**
 * The decision block's secondary calls: every call other than the
 * recommended one, minus "advance" once there's no further stage to move to
 * (the decision block itself is hidden entirely for Hired/Closed, so this
 * only matters for an Offer-stage candidate recommended something other
 * than advance, where "Advance to Hired" still needs to stay available).
 */
export function secondaryDecisionCalls(candidate: RecruiterCandidate): RecruiterDecisionCall[] {
  const recommended = candidate.decision?.recommended;
  const canAdvance = Boolean(nextRecruiterStage(candidate.stage));
  return RECRUITER_DECISION_CALLS.filter((call) => call !== recommended && (call !== "advance" || canAdvance));
}

// ---------------------------------------------------------------------------
// Submission readiness (RDS-989)
// ---------------------------------------------------------------------------

/** Candidates at Interview or later are eligible for submission, including a candidate later Closed after having reached Interview; everyone else honestly isn't yet. */
export function isSubmissionEligible(candidate: RecruiterCandidate): boolean {
  const interviewRank = RECRUITER_STAGES.indexOf("Interview");
  const reachedInterview = (stage: RecruiterStage) => RECRUITER_STAGES.indexOf(stage) >= interviewRank;
  return reachedInterview(candidate.stage) || candidate.stageHistory.some((entry) => reachedInterview(entry.stage));
}

export interface RecruiterSubmissionChecklistItem {
  label: string;
  done: boolean;
}

/** The submission readiness checklist, computed live off real candidate state, never seeded. */
export function computeSubmissionChecklist(candidate: RecruiterCandidate): RecruiterSubmissionChecklistItem[] {
  return [
    { label: "Review complete", done: candidate.review.status === "Complete" },
    { label: "Outreach current", done: candidate.outreach.touches.length > 0 && candidate.outreach.status !== "Not started" },
    { label: "Notes present", done: Boolean(candidate.notes?.trim()) },
    { label: "No open questions", done: candidate.review.openQuestions.length === 0 },
  ];
}

/** True once every checklist item is done and the packet hasn't already been shared, the pipeline's submission-ready indicator. */
export function isSubmissionReady(candidate: RecruiterCandidate): boolean {
  if (!isSubmissionEligible(candidate)) return false;
  if (candidate.submission.status === "Submitted to hiring manager") return false;
  return computeSubmissionChecklist(candidate).every((item) => item.done);
}
