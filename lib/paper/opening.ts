import type { Application } from "@/lib/applications/types";
import { openingById, savedOpenings, type Opening } from "@/lib/search/types";

type PapersContext = {
  applications: readonly Application[];
  openings: readonly Opening[];
};

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

export type LetterTarget = {
  opening: Opening;
  applicationId?: string;
};

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
