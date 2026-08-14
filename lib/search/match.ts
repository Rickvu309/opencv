/**
 * Whether an opening answers a query about the user's own opportunities.
 *
 * This is not a web-scale people search. The corpus is the openings they
 * track (pasted) plus the seeded examples. The matcher is honest about that:
 * it looks through title, company, city, the posting, requirement lines, and
 * whether the row is saved or an example. It does not invent a live job board.
 *
 * Tokens are AND'd after folding Vietnamese diacritics, so "viec data o ha noi"
 * and "Việc data ở Hà Nội" hit the same Hà Nội data rows. Particles ("ở",
 * "the") are dropped so a natural phrase is not failed by a word no posting
 * would print.
 */

import type { Opening } from "@/lib/search/types";

const STOP = new Set([
  "o",
  "tai",
  "va",
  "voi",
  "mot",
  "cac",
  "nhung",
  "hay",
  "cho",
  "cua",
  "la",
  "the",
  "a",
  "an",
  "in",
  "at",
  "of",
  "for",
  "to",
  "or",
  "and",
  "on",
  "tin",
  "viec",
  "job",
  "jobs",
  "opening",
  "openings",
  "company",
  "companies",
  "cong",
  "ty",
]);

export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Words that must all appear somewhere on the opening. */
export function queryTokens(query: string): string[] {
  return foldText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

function openingHaystack(opening: Opening): string {
  const location = opening.location ?? "";
  const requirements = opening.requirements.flatMap((requirement) => [
    requirement.label.vi,
    requirement.label.en,
    ...requirement.skills,
  ]);
  return [
    opening.title,
    opening.org,
    opening.description,
    location,
    location.replace(/\s+/g, ""),
    ...requirements,
    opening.saved ? "saved da luu bookmark" : "",
    opening.seeded ? "example vi du seeded" : "",
  ].join(" ");
}

/** True when every meaningful token in `query` appears on the opening. */
export function matchOpening(opening: Opening, query: string): boolean {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  const hay = foldText(openingHaystack(opening));
  return tokens.every((token) => hay.includes(token));
}

/** True when every meaningful token in `query` appears in one field. */
export function matchField(text: string | undefined, query: string): boolean {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  const hay = foldText(text ?? "");
  return tokens.every((token) => hay.includes(token));
}

export const SEARCH_FIELDS = [
  "anywhere",
  "title",
  "org",
  "city",
  "requirements",
] as const;

export type SearchField = (typeof SEARCH_FIELDS)[number];

function fieldHaystack(opening: Opening, field: SearchField): string {
  if (field === "anywhere") return openingHaystack(opening);
  if (field === "title") return `${opening.title} ${opening.description}`;
  if (field === "org") return opening.org;
  if (field === "city") {
    const location = opening.location ?? "";
    return `${location} ${location.replace(/\s+/g, "")}`;
  }
  return opening.requirements
    .flatMap((requirement) => [
      requirement.label.vi,
      requirement.label.en,
      ...requirement.skills,
    ])
    .join(" ");
}

/** `matchOpening`, but only against the field the scope dropdown named. */
export function matchOpeningField(
  opening: Opening,
  query: string,
  field: SearchField,
): boolean {
  if (field === "anywhere") return matchOpening(opening, query);
  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;
  const hay = foldText(fieldHaystack(opening, field));
  return tokens.every((token) => hay.includes(token));
}

/**
 * Hide this opening if any exclude token appears in title, company, or the
 * posting. OR, not AND: one banned word is enough.
 */
export function excludesOpening(opening: Opening, exclude: string): boolean {
  const tokens = queryTokens(exclude);
  if (tokens.length === 0) return false;
  const hay = foldText(
    [opening.title, opening.org, opening.description].join(" "),
  );
  return tokens.some((token) => hay.includes(token));
}
