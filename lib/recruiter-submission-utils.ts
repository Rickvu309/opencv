import type { RecruiterCandidate, RecruiterHiringManagerSummary } from "@/lib/types";

// RDS-989: the hiring-manager summary fallback. Every fully-seeded eligible
// candidate carries a seeded RecruiterSubmission.draftSummary; every other
// eligible candidate falls back to this, grounded in the same aiStrengths,
// aiWatchouts, and suggestedNextStep fields already seeded for every
// candidate, never generic filler.

export function buildFallbackHiringManagerSummary(candidate: RecruiterCandidate): RecruiterHiringManagerSummary {
  return {
    recommendation: candidate.suggestedNextStep,
    evidence: candidate.aiStrengths,
    risk: candidate.aiWatchouts,
  };
}

/** Seeded draftSummary if the candidate has one, otherwise the fallback. */
export function getHiringManagerSummaryDraft(candidate: RecruiterCandidate): RecruiterHiringManagerSummary {
  return candidate.submission.draftSummary ?? buildFallbackHiringManagerSummary(candidate);
}
