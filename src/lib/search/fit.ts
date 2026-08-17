/**
 * How close this person is to this opening.
 *
 * Matching is the same matching the catalogue scorer uses (`matchRequirements`):
 * evidence from the profile, unprovable requirements excluded. Catalogue
 * `fitFor` then adds a readiness term from the role's stage; an opening has no
 * stage, so it never goes through that door.
 *
 * AC-SEARCH-003.2: fit on an opening is met versus total requirements, with no
 * score not derived from those requirements.
 */

import { matchRequirements, type FitProfile, type RequirementMatch } from "@/lib/catalogue";
import type { AppState } from "@/lib/actions/types";
import type { Opening } from "@/lib/search/types";

export type OpeningFit = RequirementMatch & {
  /** How many of the provable requirements are met. */
  metCount: number;
  /** How many were provable at all. Zero when the posting names none. */
  total: number;
};

/** The slice of state the fit reads. */
export function fitProfileOf(state: AppState): FitProfile {
  return {
    education: {
      major: state.profile.education.major,
      year: state.profile.education.year,
      courses: state.profile.education.courses,
    },
    experience: state.profile.experience,
  };
}

/**
 * Fit against one opening.
 *
 * Requirement match only. Catalogue `fitFor` adds a readiness term from the
 * role's stage; an opening has no stage, so it never goes through that door.
 */
export function openingFit(profile: FitProfile, opening: Opening): OpeningFit {
  const match = matchRequirements(profile, { requires: opening.requirements });

  return {
    ...match,
    metCount: match.met.length,
    total: match.met.length + match.missing.length,
  };
}

/**
 * Openings, best fit first.
 *
 * An opening that names no provable requirement ranks last rather than first.
 * A ratio of zero over zero is not a perfect match; it is an absence of
 * information, and sorting it to the top would put the least informative
 * postings in front of the user.
 */
export function rankOpenings(
  profile: FitProfile,
  openings: readonly Opening[],
): { opening: Opening; fit: OpeningFit }[] {
  return openings
    .map((opening) => ({ opening, fit: openingFit(profile, opening) }))
    .sort((a, b) => ratio(b.fit) - ratio(a.fit));
}

function ratio(fit: OpeningFit): number {
  return fit.total === 0 ? -1 : fit.metCount / fit.total;
}

/**
 * Is there enough profile to rank on?
 *
 * AC-SEARCH-001.2. Ranking an empty profile produces a list in which everything
 * scores zero, ordered by nothing, and presenting that as "openings matched to
 * your profile" is the kind of quiet dishonesty the product exists not to do.
 */
export function hasProfileFacts(state: AppState): boolean {
  const { education, experience, identity } = state.profile;
  return (
    education.courses.length > 0 ||
    experience.length > 0 ||
    education.major.trim().length > 0 ||
    identity.targetRole.trim().length > 0
  );
}
