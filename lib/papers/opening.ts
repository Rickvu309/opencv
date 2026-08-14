import type { Application } from "@/lib/applications/types";
import { openingById, savedOpenings, type Opening } from "@/lib/search/types";

type PapersContext = {
  applications: readonly Application[];
  openings: readonly Opening[];
};

/**
 * The opening a letter was tailored for, when one exists.
 *
 * Binding lives on the application (`tailoredDocumentIds`), not on the paper:
 * a letter can be written before anyone files an application, and the same
 * paper model is used for project write-ups that have no job at all.
 */
export function openingForPaper(
  state: PapersContext,
  paperId: string,
): Opening | undefined {
  const application = state.applications.find((entry) =>
    entry.tailoredDocumentIds.includes(paperId),
  );
  if (!application) return undefined;
  return openingById(state.openings, application.openingId);
}

/** A saved job (and its application, if any) a new letter can be aimed at. */
export type LetterTarget = {
  opening: Opening;
  applicationId?: string;
};

/**
 * Jobs the Letters empty state and the New menu can create from.
 *
 * Applications first: those are jobs the user is already moving on. Saved
 * openings without an application follow. Seeded examples stay out; they are
 * not this person's search.
 */
export function letterTargets(state: PapersContext): LetterTarget[] {
  const seen = new Set<string>();
  const targets: LetterTarget[] = [];

  for (const application of state.applications) {
    const opening = openingById(state.openings, application.openingId);
    if (!opening || seen.has(opening.id)) continue;
    seen.add(opening.id);
    targets.push({ opening, applicationId: application.id });
  }

  for (const opening of savedOpenings(state.openings)) {
    if (seen.has(opening.id)) continue;
    seen.add(opening.id);
    targets.push({ opening });
  }

  return targets;
}
