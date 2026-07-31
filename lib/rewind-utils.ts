import type { RewindCandidate, RewindProposedAchievement, TrackRecordEntry } from "@/lib/types";

// Shared read-only helpers for Rewind's candidate review: the count behind
// its Goal-Gradient progress indicator, and the builder that turns a
// candidate plus its (possibly edited) proposed fields into the
// TrackRecordEntry Saving actually writes. Kept separate from lib/store.tsx
// so the review cards and the store stay thin and testable against plain
// data, the same split lib/inbox-utils.ts and lib/nudge-utils.ts already use.

export function reviewedCandidateCount(candidates: RewindCandidate[]): number {
  return candidates.filter((candidate) => candidate.state !== "pending").length;
}

export function savedAchievementCount(candidates: RewindCandidate[]): number {
  return candidates.filter((candidate) => candidate.state === "saved").length;
}

/**
 * Builds the TrackRecordEntry a saved candidate writes: the achievement
 * storage model from section 4, a TrackRecordEntry with its new optional
 * depth (impactSignals, sourceRefs, pathRelevance, highlight), never a
 * separate object. `proposed` is passed separately from `candidate.proposed`
 * so an inline edit made just before Save is reflected exactly.
 */
export function buildAchievementEntry(
  candidate: RewindCandidate,
  proposed: RewindProposedAchievement
): TrackRecordEntry {
  return {
    id: candidate.targetEntryId,
    title: proposed.title,
    story: candidate.observed.activityLine,
    impact: proposed.impactLine,
    date: candidate.date,
    evidenceTag: candidate.evidenceTag,
    skillIds: proposed.skillIds,
    status: "confirmed",
    impactSignals: proposed.impactSignals,
    sourceRefs: candidate.observed.evidenceIds,
    pathRelevance: proposed.pathRelevance,
    highlight: true,
  };
}
