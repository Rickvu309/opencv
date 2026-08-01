import { daysBetween } from "@/lib/opportunity-utils";
import type { ChipTone } from "@/components/shared/chip-tones";
import type { RecruiterCandidate, RecruiterReadiness, RecruiterRole, RecruiterSource, RecruiterStage } from "@/lib/types";

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
 * itself renders.
 */
export function getRecruiterAttentionItems(candidates: RecruiterCandidate[], todayIso: string): RecruiterAttentionItem[] {
  return candidates
    .filter((candidate): candidate is RecruiterCandidate & { attentionTemplate: string } => Boolean(candidate.attentionTemplate))
    .map((candidate) => ({
      candidateId: candidate.id,
      reason: candidate.attentionTemplate.replace("{days}", String(daysInStage(candidate, todayIso))),
    }))
    .slice(0, 3);
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
