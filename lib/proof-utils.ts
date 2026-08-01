import type {
  ClaimVerification,
  ClaimVerificationState,
  CvVersion,
  Opportunity,
  Profile,
  ProofClaim,
  ProofContext,
  ProofEvidenceRanking,
  ProofSaveTarget,
  ProofStrengthLevel,
  TrackRecordEntry,
} from "@/lib/types";

// Shared read-only helpers for the Proof Builder (/proof, RDS-987): ranking
// confirmed Track Record entries by proof strength for a chosen context, and
// verifying CV/profile claims against what Track Record actually backs.
// Both are computed live off real state, the same "computed, not seeded"
// split the Path Planner's gap analysis and Rewind's week story already use;
// only the transformation blocks in lib/data/proof.ts are scripted content.
// Kept dependency-free so the /proof page and its components stay thin and
// this stays testable against plain data.

const RECENT_WINDOW_DAYS = 365;
const OLDER_WINDOW_DAYS = 730;
const HAS_DIGIT = /\d/;

function daysSince(dateIso: string): number {
  const entryTime = new Date(dateIso).getTime();
  if (Number.isNaN(entryTime)) return Number.POSITIVE_INFINITY;
  return (Date.now() - entryTime) / (1000 * 60 * 60 * 24);
}

function hasImpactNumber(entry: TrackRecordEntry): boolean {
  return HAS_DIGIT.test(entry.impact) || Boolean(entry.impactSignals?.some((signal) => signal.kind === "metric"));
}

function hasEvidenceReference(entry: TrackRecordEntry): boolean {
  return Boolean(entry.evidenceNote) || Boolean(entry.sourceRefs?.length);
}

export const PROOF_CONTEXT_LABEL: Record<ProofContext["type"], string> = {
  cv: "CV version",
  profile: "Profile",
  opportunity: "Opportunity",
  path: "Target path",
};

/**
 * Every confirmed entry ranked strongest first for the chosen context.
 * Strength derives from 4 signals named in the brief: whether the entry
 * carries a typed impact signal or a numbered outcome, its evidence tag,
 * recency, and relevance to the specific context object (already cited in
 * this CV, already positioning this opportunity, flagged as a highlight for
 * the profile, or explicitly tied to the target path).
 */
export function rankEvidenceForContext(
  context: ProofContext,
  trackRecordEntries: TrackRecordEntry[],
  opportunities: Opportunity[]
): ProofEvidenceRanking[] {
  const opportunity =
    context.type === "opportunity" ? opportunities.find((item) => item.id === context.refId) : undefined;

  const rankings = trackRecordEntries
    .filter((entry) => entry.status === "confirmed")
    .map((entry) => {
      const signalScore = entry.impactSignals && entry.impactSignals.length > 0 ? 2 : HAS_DIGIT.test(entry.impact) ? 1 : 0;
      const tagScore = entry.evidenceTag === "Metric" || entry.evidenceTag === "Case study" ? 1 : 0;
      const days = daysSince(entry.date);
      const recencyScore = days <= RECENT_WINDOW_DAYS ? 2 : days <= OLDER_WINDOW_DAYS ? 1 : 0;

      let relevanceScore = 0;
      const parts: string[] = [];

      if (signalScore === 2) {
        parts.push(`carries ${entry.impactSignals!.length} named impact signal${entry.impactSignals!.length > 1 ? "s" : ""}`);
      } else if (signalScore === 1) {
        parts.push(`names a measured outcome ("${entry.impact}")`);
      }
      if (tagScore) parts.push(`tagged ${entry.evidenceTag}`);
      if (recencyScore === 2) parts.push("from the last year");
      else if (recencyScore === 1) parts.push("from the last two years");

      if (context.type === "cv") {
        const usedInThisCv = entry.usedIn?.some((ref) => ref.kind === "cv" && ref.id === context.refId);
        if (usedInThisCv) {
          relevanceScore = 2;
          parts.push("already cited in this CV");
        }
      } else if (context.type === "opportunity") {
        const usedInThisOpportunity = entry.usedIn?.some((ref) => ref.kind === "opportunity" && ref.id === context.refId);
        if (usedInThisOpportunity) {
          relevanceScore = 2;
          parts.push("already used in this opportunity's positioning");
        } else if (opportunity && entry.strengthens?.toLowerCase().includes(opportunity.company.toLowerCase())) {
          relevanceScore = 1;
          parts.push(`strengthens: "${entry.strengthens}"`);
        }
      } else if (context.type === "profile") {
        if (entry.highlight) {
          relevanceScore = 2;
          parts.push("flagged as a Track Record highlight");
        }
      } else if (context.type === "path") {
        if (entry.pathRelevance) {
          relevanceScore = 2;
          parts.push(`ties to the target path: "${entry.pathRelevance}"`);
        } else if (entry.highlight) {
          relevanceScore = 1;
          parts.push("flagged as a Track Record highlight");
        }
      }

      const total = signalScore + tagScore + recencyScore + relevanceScore;
      const strength: ProofStrengthLevel = total >= 4 ? "Strong" : total >= 2 ? "Medium" : "Weak";
      const whyStrength =
        parts.length > 0
          ? `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}${parts.length > 1 ? `, ${parts.slice(1).join(", ")}` : ""}.`
          : `No impact signal, recent date, or tie to this ${PROOF_CONTEXT_LABEL[context.type].toLowerCase()} found yet.`;

      return {
        entry,
        strength,
        whyStrength,
        couldBeStronger: !hasImpactNumber(entry) && !hasEvidenceReference(entry),
        total,
      };
    });

  return rankings
    .sort((a, b) => b.total - a.total)
    .map(({ entry, strength, whyStrength, couldBeStronger }) => ({ entry, strength, whyStrength, couldBeStronger }));
}

/** Claims read live off the chosen context: CV sections, or profile strengths plus the summary. Opportunity and path contexts carry no claims, only transformations. */
export function buildClaimsForContext(context: ProofContext, profile: Profile, cvVersions: CvVersion[]): ProofClaim[] {
  if (context.type === "cv") {
    const cv = cvVersions.find((item) => item.id === context.refId);
    if (!cv) return [];
    return cv.sections.map((section) => ({
      id: `claim-cv-${cv.id}-${section.id}`,
      contextType: "cv",
      sourceKind: "cv-section",
      label: section.title,
      text: section.content,
      cvId: cv.id,
    }));
  }

  if (context.type === "profile") {
    const strengthClaims: ProofClaim[] = profile.strengths.map((strength, index) => ({
      id: `claim-profile-strength-${index}`,
      contextType: "profile",
      sourceKind: "profile-strength",
      label: strength,
      text: strength,
    }));
    const summaryClaim: ProofClaim = {
      id: "claim-profile-summary",
      contextType: "profile",
      sourceKind: "profile-summary",
      label: "Summary",
      text: profile.summary,
    };
    return [...strengthClaims, summaryClaim];
  }

  return [];
}

function extractNumberTokens(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

/** Verifies one claim against confirmed Track Record entries, never seeded. */
export function verifyClaim(claim: ProofClaim, trackRecordEntries: TrackRecordEntry[], profile: Profile): ClaimVerification {
  const confirmed = trackRecordEntries.filter((entry) => entry.status === "confirmed");

  if (claim.sourceKind === "profile-strength") {
    const evidence = profile.strengthEvidence.find((item) => item.strength === claim.text);
    const entry = evidence?.trackRecordEntryId
      ? confirmed.find((item) => item.id === evidence.trackRecordEntryId)
      : undefined;

    if (!evidence || !entry) {
      return {
        claim,
        state: "no-evidence-yet",
        backingEntryIds: [],
        note: "This claim would land harder with a specific entry behind it.",
        proposedCaptureLabel: `Capture or link a Track Record entry that backs "${claim.text}."`,
      };
    }

    const wellSupported = hasImpactNumber(entry) && hasEvidenceReference(entry);
    return wellSupported
      ? { claim, state: "well-supported", backingEntryIds: [entry.id], note: evidence.note }
      : {
          claim,
          state: "needs-stronger-proof",
          backingEntryIds: [entry.id],
          note: `Backed by "${entry.title}," but ${!hasImpactNumber(entry) ? "would land harder with a number behind it" : "still needs a named evidence reference"}.`,
        };
  }

  if (claim.sourceKind === "profile-summary") {
    const matched = confirmed.filter((entry) =>
      extractNumberTokens(entry.impact).some((token) => claim.text.includes(token))
    );
    if (matched.length > 0) {
      return {
        claim,
        state: "well-supported",
        backingEntryIds: matched.map((entry) => entry.id),
        note: `Cites a real number from ${matched.map((entry) => `"${entry.title}"`).join(" and ")}.`,
      };
    }
    if (HAS_DIGIT.test(claim.text)) {
      return {
        claim,
        state: "needs-stronger-proof",
        backingEntryIds: [],
        note: "Names an outcome, but it doesn't trace back to a specific captured Track Record entry yet.",
      };
    }
    return {
      claim,
      state: "no-evidence-yet",
      backingEntryIds: [],
      note: "This claim would land harder with a number behind it.",
      proposedCaptureLabel: "Add a named outcome number from a confirmed Track Record entry.",
    };
  }

  // cv-section
  const backing = confirmed.filter((entry) => entry.usedIn?.some((ref) => ref.kind === "cv" && ref.id === claim.cvId));
  if (backing.length === 0) {
    return {
      claim,
      state: "no-evidence-yet",
      backingEntryIds: [],
      note: `No confirmed entry cites the ${claim.label} section yet.`,
      proposedCaptureLabel: `Capture a Track Record entry and link it to the ${claim.label} section.`,
    };
  }

  const strong = backing.filter((entry) => hasImpactNumber(entry) && hasEvidenceReference(entry));
  if (strong.length === backing.length) {
    return {
      claim,
      state: "well-supported",
      backingEntryIds: backing.map((entry) => entry.id),
      note: `Backed by ${backing.map((entry) => `"${entry.title}"`).join(" and ")}.`,
    };
  }

  const thin = backing.filter((entry) => !strong.includes(entry));
  return {
    claim,
    state: "needs-stronger-proof",
    backingEntryIds: backing.map((entry) => entry.id),
    note: `${thin.map((entry) => `"${entry.title}"`).join(" and ")} ${thin.length === 1 ? "is" : "are"} thin on a number or a named evidence reference.`,
  };
}

export function verifyClaims(claims: ProofClaim[], trackRecordEntries: TrackRecordEntry[], profile: Profile): ClaimVerification[] {
  return claims.map((claim) => verifyClaim(claim, trackRecordEntries, profile));
}

export const CLAIM_STATE_ORDER: ClaimVerificationState[] = ["well-supported", "needs-stronger-proof", "no-evidence-yet"];

export const CLAIM_STATE_LABEL: Record<ClaimVerificationState, string> = {
  "well-supported": "Well supported",
  "needs-stronger-proof": "Needs stronger proof",
  "no-evidence-yet": "No evidence yet",
};

/** Human labels for one transformation's real save-back target, shared by the transformation card ("Targets: …") and its post-accept confirmation. */
export function describeProofTarget(
  target: ProofSaveTarget,
  cvVersions: CvVersion[],
  opportunities: Opportunity[]
): { targetLabel: string; confirmationMessage: string } {
  if (target.kind === "cv-section") {
    const cv = cvVersions.find((item) => item.id === target.cvId);
    const label = `the ${target.sectionTitle} section on ${cv?.name ?? "this CV"}`;
    return { targetLabel: label, confirmationMessage: `Updated ${label}.` };
  }
  if (target.kind === "profile-summary") {
    return { targetLabel: "your profile summary", confirmationMessage: "Updated your profile summary." };
  }
  if (target.kind === "profile-strength") {
    return {
      targetLabel: `the "${target.strength}" strength's evidence note`,
      confirmationMessage: `Updated the evidence note for "${target.strength}."`,
    };
  }
  if (target.kind === "opportunity-positioning") {
    const opportunity = opportunities.find((item) => item.id === target.opportunityId);
    const label = `${opportunity?.company ?? "this opportunity"}'s Materials as a positioning note`;
    return { targetLabel: label, confirmationMessage: `Added a positioning note to ${label}.` };
  }
  return {
    targetLabel: 'a "prove it" item in your growth plan',
    confirmationMessage: 'Pinned a "prove it" item into your growth plan.',
  };
}

/** Groups verifications by state, strongest state first, dropping empty groups. */
export function groupClaimVerificationsByState(
  verifications: ClaimVerification[]
): { state: ClaimVerificationState; items: ClaimVerification[] }[] {
  return CLAIM_STATE_ORDER.map((state) => ({
    state,
    items: verifications.filter((verification) => verification.state === state),
  })).filter((group) => group.items.length > 0);
}
