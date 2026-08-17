// How close this user is to this role, and why.
//
// The map has always shown a fit percentage beside every role. It was a literal
// in the data — `fit: 84` — so a visitor who had entered nothing at all was told
// they were an 84% fit for Data Analyst Intern, and the number never moved no
// matter what they added. It was the most persuasive thing on the screen and the
// only thing on it that was made up.
//
// This computes it, and returns the working alongside it. A percentage a student
// cannot interrogate is worth very little; "3 of 5, and here are the two you are
// missing" is advice. It is also what makes onboarding worth filling in: every
// field they complete moves a number they can see.

import { matchesMsg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import type { PathNode, Requirement, StageId } from "./graph";

/** The slice of profile this reads. Narrow so tests need not build a whole app. */
export type FitProfile = {
  education: { major: string; year: string; courses: string[] };
  experience: { title: string; org: string; detail?: string }[];
};

export type RequirementMatch = {
  /** Requirements the profile shows evidence for. */
  met: Requirement[];
  /** Requirements it does not. */
  missing: Requirement[];
  /**
   * Requirements no profile could evidence — "willingness to ask". Neither met
   * nor missing, and excluded from the score, because counting them as failures
   * would cap everyone below a hundred for a reason they cannot act on.
   */
  unprovable: Requirement[];
};

export type Fit = RequirementMatch & {
  /** 0–100. Catalogue roles only: requirement match plus readiness. */
  score: number;
};

/**
 * Strip accents and case so "SQL cơ bản", "sql", and "Advanced SQL" all match
 * the token "sql". `\p{M}` after NFD decomposition removes the combining marks
 * Vietnamese uses; đ has no decomposition, so it is replaced by hand.
 */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(new RegExp("\\p{M}", "gu"), "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Everything the user has told us that could evidence a skill. */
function evidenceFrom(profile: FitProfile): string {
  return normalise(
    [
      profile.education.major,
      ...profile.education.courses,
      ...profile.experience.flatMap((x) => [x.title, x.org, x.detail ?? ""]),
    ].join(" \n "),
  );
}

/**
 * Where the user is on the same axis the map's columns use.
 *
 * 0 is a first-year with nothing yet; 3 is someone graduated and working. The
 * study year is stored as its display string. Older accounts may still have
 * the Vietnamese labels from when the UI was bilingual.
 */
function seniority(profile: FitProfile): number {
  const { year } = profile.education;
  const o = messages.onboarding;
  const experience = profile.experience.length;

  let base = 0;
  if (yearIs(year, o.graduated, ["Đã tốt nghiệp"])) base = 2.5;
  else if (yearIs(year, o.year4, ["Năm 4"])) base = 1.5;
  else if (yearIs(year, o.year3, ["Năm 3"])) base = 1;
  else if (yearIs(year, o.year2, ["Năm 2"])) base = 0.5;
  else if (yearIs(year, o.year1, ["Năm 1"])) base = 0;
  // No year given: assume a student partway through rather than a blank slate,
  // which would make every entry role look further away than it is.
  else base = 0.5;

  // Real experience moves you along the axis faster than time does.
  return Math.min(3, base + Math.min(experience, 2) * 0.75);
}

function yearIs(
  year: string,
  entry: (typeof messages.onboarding)["year1"],
  aliases: readonly string[],
): boolean {
  if (matchesMsg(entry, year)) return true;
  const folded = normalise(year);
  return aliases.some((alias) => normalise(alias) === folded);
}

/** Where a role sits on that axis. */
const stagePosition: Record<StageId, number> = {
  now: 0,
  entry: 1,
  core: 2,
  growth: 3,
};

/**
 * How ready this user is for this stage, 0–1.
 *
 * Being *past* a stage is not a penalty: a graduate with a year of work is not
 * a worse fit for an internship than a second-year, they are simply unlikely to
 * want one. Only the distance still to travel counts against the score.
 */
function readiness(profile: FitProfile, stage: StageId): number {
  const gap = stagePosition[stage] - seniority(profile);
  if (gap <= 0) return 1;
  return Math.max(0, 1 - gap / 3);
}

/**
 * Requirement match only: met, missing, unprovable. Search uses this; it has
 * no catalogue stage and must not pick up a readiness term.
 */
export function matchRequirements(
  profile: FitProfile,
  target: { requires?: readonly Requirement[] },
): RequirementMatch {
  const requirements = target.requires ?? [];
  const evidence = evidenceFrom(profile);

  const unprovable = requirements.filter((r) => r.skills.length === 0);
  const provable = requirements.filter((r) => r.skills.length > 0);
  const met = provable.filter((r) =>
    r.skills.some((skill) => evidence.includes(normalise(skill))),
  );
  const missing = provable.filter((r) => !met.includes(r));

  return { met, missing, unprovable };
}

/**
 * Fit, and the reasoning behind it.
 *
 * Weighted toward evidence rather than seniority, because what you can show is
 * more actionable than how long you have been studying: a second-year with SQL
 * and a project should outrank a final-year with neither, and the product's
 * whole argument is that the gap is closable.
 */
export function fitFor(profile: FitProfile, node: PathNode): Fit {
  const match = matchRequirements(profile, node);
  const ready = readiness(profile, node.stage);
  const provable = match.met.length + match.missing.length;
  // A role with nothing provable — every requirement is judgement or years
  // served — is scored on readiness alone rather than on a division by zero.
  const evidenceRatio = provable > 0 ? match.met.length / provable : ready;

  return {
    ...match,
    score: Math.round(100 * (0.65 * evidenceRatio + 0.35 * ready)),
  };
}

/** The roles this user is closest to, best first. */
export function rankByFit(
  profile: FitProfile,
  nodes: readonly PathNode[],
): { node: PathNode; fit: Fit }[] {
  return nodes
    .filter((node) => node.stage !== "now")
    .map((node) => ({ node, fit: fitFor(profile, node) }))
    .sort((a, b) => b.fit.score - a.fit.score);
}
