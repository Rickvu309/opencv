/**
 * How close this person is to this opening.
 *
 * ## No new scoring logic
 *
 * WO-56 is explicit: the calculator that scored role archetypes now scores real
 * openings, unchanged. So the matching here is the same matching: the evidence
 * is drawn from the profile the same way, requirements with no provable skill
 * are excluded rather than failed, and an accented Vietnamese course name still
 * matches a lowercase English skill.
 *
 * ## One deliberate difference, and why
 *
 * The archetype score is 65% evidence and 35% readiness, where readiness is a
 * judgement about how far through a degree somebody is. AC-SEARCH-003.2 forbids
 * that here: fit on an opening must be "met versus total requirements, with no
 * score not derived from those requirements". So an opening's fit is the ratio
 * and nothing else.
 *
 * That is not a change to the calculation, it is a change to what is shown. A
 * student looking at a real posting deserves to know that they meet three of
 * its five requirements, not that an opaque number says 62.
 */

import { fitFor, type Fit, type FitProfile } from "@/lib/career-fit";
import type { AppState } from "@/lib/actions/types";
import type { Opening } from "@/lib/search/types";

export type OpeningFit = {
  met: Fit["met"];
  missing: Fit["missing"];
  /** Requirements no profile could evidence. Excluded, never counted as failed. */
  unprovable: Fit["unprovable"];
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
 * `fitFor` wants a target with `requires` and a `stage`; an opening has no
 * stage, and the readiness term it feeds is exactly what this must not use.
 * Passing `entry` keeps the call type-correct and the returned `score` is
 * deliberately discarded: only the requirement lists are read.
 */
export function openingFit(profile: FitProfile, opening: Opening): OpeningFit {
  const fit = fitFor(profile, {
    id: opening.id,
    title: opening.title,
    stage: "entry",
    summary: { vi: opening.description, en: opening.description },
    requires: opening.requirements,
  });

  return {
    met: fit.met,
    missing: fit.missing,
    unprovable: fit.unprovable,
    metCount: fit.met.length,
    total: fit.met.length + fit.missing.length,
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
