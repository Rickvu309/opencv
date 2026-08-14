/**
 * Turn a spoken ask into filters (must match) and criteria (rank only).
 *
 * Search is opportunity search over pasted postings plus examples. The
 * sentence is not sent to a job board. Filters narrow the corpus the student
 * already has; criteria decide which of those rows sit first, and they are
 * what the result row cites when it says why a posting fits.
 */

import type { Requirement } from "@/lib/career-graph";
import { foldText, matchField, queryTokens } from "@/lib/search/match";
import type { OpeningFit } from "@/lib/search/fit";
import { SKILL_VOCABULARY, type Opening } from "@/lib/search/types";

export const SEARCH_SCOPES = ["all", "saved", "seeded"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

export type SearchAsk = {
  role: string;
  city: string;
  org: string;
  scope: SearchScope;
  /** Skill keys, lowercase, same vocabulary the fit calculator uses. */
  criteria: string[];
};

export type WhyLine =
  | { kind: "criterion"; skill: string }
  | { kind: "met"; requirement: Requirement }
  | { kind: "missing"; requirement: Requirement };

const SAVED_MARKERS = [
  "tin da luu",
  "da luu",
  "saved openings",
  "saved only",
  "saved",
];
const SEEDED_MARKERS = ["tin vi du", "vi du", "examples", "example"];

const CITY_ALIASES: Record<string, string[]> = {
  "Hà Nội": ["hanoi", "ha noi"],
  "TP. Hồ Chí Minh": ["hcmc", "tphcm", "ho chi minh", "sai gon", "saigon"],
};

export function emptyAsk(): SearchAsk {
  return { role: "", city: "", org: "", scope: "all", criteria: [] };
}

export function filterCount(ask: SearchAsk): number {
  return (
    Number(ask.role.trim().length > 0) +
    Number(ask.city.trim().length > 0) +
    Number(ask.org.trim().length > 0) +
    Number(ask.scope !== "all")
  );
}

export function criteriaCount(ask: SearchAsk): number {
  return ask.criteria.length;
}

export function skillDisplayName(skill: string): string {
  const key = skill.trim().toLowerCase();
  if (key === "sql" || key === "etl" || key === "r") return key.toUpperCase();
  return key.replace(/\b\w+/g, (word) => {
    if (word === "bi" || word === "sql" || word === "etl") return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

export function serializeAsk(ask: SearchAsk): string {
  const parts: string[] = [];
  if (ask.role.trim()) parts.push(ask.role.trim());
  if (ask.city.trim()) parts.push(ask.city.trim());
  if (ask.org.trim()) parts.push(ask.org.trim());
  if (ask.scope === "saved") parts.push("tin đã lưu");
  if (ask.scope === "seeded") parts.push("tin ví dụ");
  for (const skill of ask.criteria) parts.push(skillDisplayName(skill));
  return parts.join(" ");
}

export function interpretQuery(
  query: string,
  openings: readonly Opening[],
): SearchAsk {
  const ask = emptyAsk();
  if (!query.trim()) return ask;

  let hay = foldText(query);

  if (SAVED_MARKERS.some((marker) => hay.includes(marker))) {
    ask.scope = "saved";
    for (const marker of SAVED_MARKERS) hay = stripMarker(hay, marker);
  } else if (SEEDED_MARKERS.some((marker) => hay.includes(marker))) {
    ask.scope = "seeded";
    for (const marker of SEEDED_MARKERS) hay = stripMarker(hay, marker);
  }

  const cities = uniqueByLength(
    openings
      .map((opening) => opening.location)
      .filter((value): value is string => Boolean(value)),
  );
  for (const city of cities) {
    const aliases = CITY_ALIASES[city] ?? [];
    if (!fieldPresent(hay, city, aliases)) continue;
    ask.city = city;
    hay = stripField(hay, city, aliases);
    break;
  }

  const orgs = uniqueByLength(openings.map((opening) => opening.org).filter(Boolean));
  for (const org of orgs) {
    const tokens = queryTokens(org).filter((token) => token.length > 4);
    const hit =
      fieldPresent(hay, org) || tokens.some((token) => hay.includes(token));
    if (!hit) continue;
    ask.org = org;
    hay = stripField(hay, org);
    for (const token of tokens) hay = stripMarker(hay, token);
    break;
  }

  const extracted = extractSkills(hay, openings);
  ask.criteria = extracted.skills;
  hay = extracted.hay;

  const leftover = queryTokens(hay);
  if (leftover.length > 0) {
    const wanted = new Set(leftover);
    const label = query
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => wanted.has(foldText(word)))
      .join(" ");
    ask.role = label || leftover.join(" ");
  }

  return ask;
}

export function matchesAsk(opening: Opening, ask: SearchAsk): boolean {
  if (ask.scope === "saved" && !opening.saved) return false;
  if (ask.scope === "seeded" && !opening.seeded) return false;
  if (ask.city.trim() && !locationMatches(opening, ask.city)) return false;
  if (ask.org.trim() && !orgMatches(opening, ask.org)) return false;
  if (ask.role.trim() && !roleMatches(opening, ask.role)) return false;
  return true;
}

export function rankByAsk<T extends { opening: Opening; fit: OpeningFit }>(
  rows: readonly T[],
  ask: SearchAsk,
): T[] {
  if (ask.criteria.length === 0) return [...rows];
  return [...rows].sort((a, b) => {
    const hits = criteriaHits(b.opening, ask.criteria) - criteriaHits(a.opening, ask.criteria);
    if (hits !== 0) return hits;
    return fitRatio(b.fit) - fitRatio(a.fit);
  });
}

export function openingHasSkill(opening: Opening, skill: string): boolean {
  const needle = foldText(skill);
  if (!needle) return false;
  if (
    opening.requirements.some((requirement) =>
      requirement.skills.some((entry) => foldText(entry) === needle),
    )
  ) {
    return true;
  }
  return openingHay(opening).includes(needle);
}

export function whyOpening(
  opening: Opening,
  fit: OpeningFit,
  ask: SearchAsk,
): WhyLine[] {
  const lines: WhyLine[] = [];
  const cited = new Set<string>();

  for (const skill of ask.criteria) {
    if (!openingHasSkill(opening, skill)) continue;
    lines.push({ kind: "criterion", skill });
    cited.add(foldText(skill));
  }

  for (const requirement of fit.met) {
    if (lines.length >= 3) break;
    const overlap = requirement.skills.some((skill) => cited.has(foldText(skill)));
    if (overlap) continue;
    lines.push({ kind: "met", requirement });
  }

  if (lines.length < 3 && fit.missing[0]) {
    lines.push({ kind: "missing", requirement: fit.missing[0] });
  }

  return lines.slice(0, 3);
}

function criteriaHits(opening: Opening, criteria: readonly string[]): number {
  return criteria.filter((skill) => openingHasSkill(opening, skill)).length;
}

function fitRatio(fit: OpeningFit): number {
  return fit.total === 0 ? -1 : fit.metCount / fit.total;
}

function roleMatches(opening: Opening, role: string): boolean {
  return matchField(`${opening.title} ${opening.org} ${opening.description}`, role);
}

function orgMatches(opening: Opening, org: string): boolean {
  if (matchField(opening.org, org)) return true;
  const tokens = queryTokens(org).filter((token) => token.length > 4);
  const hay = foldText(opening.org);
  return tokens.some((token) => hay.includes(token));
}

function locationMatches(opening: Opening, city: string): boolean {
  if (matchField(opening.location, city)) return true;
  const location = opening.location;
  if (!location) return false;
  if (foldText(location) === foldText(city)) return true;
  const aliases = CITY_ALIASES[location] ?? [];
  return fieldPresent(foldText(city), location, aliases);
}

function extractSkills(
  hay: string,
  openings: readonly Opening[],
): { skills: string[]; hay: string } {
  const skills: string[] = [];
  let next = hay;
  for (const { key, aliases } of skillCatalog(openings)) {
    let hit = false;
    for (const alias of aliases) {
      if (!fieldPresent(next, alias)) continue;
      hit = true;
      next = stripField(next, alias);
    }
    if (hit) skills.push(key);
  }
  return { skills, hay: next };
}

function skillCatalog(
  openings: readonly Opening[],
): { key: string; aliases: string[] }[] {
  const byKey = new Map<string, Set<string>>();
  for (const [key, aliases] of Object.entries(SKILL_VOCABULARY)) {
    byKey.set(key, new Set([key, ...aliases]));
  }
  for (const opening of openings) {
    for (const requirement of opening.requirements) {
      for (const skill of requirement.skills) {
        const key = skill.toLowerCase();
        const aliases = byKey.get(key) ?? new Set<string>();
        aliases.add(key);
        byKey.set(key, aliases);
      }
    }
  }
  return [...byKey]
    .map(([key, aliases]) => ({
      key,
      aliases: [...aliases].sort((a, b) => foldText(b).length - foldText(a).length),
    }))
    .sort((a, b) => longest(b.aliases) - longest(a.aliases));
}

function longest(aliases: string[]): number {
  return Math.max(0, ...aliases.map((alias) => foldText(alias).length));
}

function uniqueByLength(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => b.length - a.length);
}

function fieldPresent(hay: string, value: string, aliases: string[] = []): boolean {
  if (presentIn(hay, value)) return true;
  return aliases.some((alias) => presentIn(hay, alias));
}

function presentIn(hay: string, value: string): boolean {
  const folded = foldText(value);
  if (!folded) return false;
  if (folded.length <= 2) {
    return hay.split(/[^\p{L}\p{N}]+/u).includes(folded);
  }
  const compactHay = hay.replace(/\s+/g, "");
  if (hay.includes(folded)) return true;
  const compact = folded.replace(/\s+/g, "");
  return compact.length > 3 && compactHay.includes(compact);
}

function stripField(hay: string, value: string, aliases: string[] = []): string {
  let next = stripMarker(hay, foldText(value));
  next = stripMarker(next, foldText(value).replace(/\s+/g, ""));
  for (const alias of aliases) {
    next = stripMarker(next, foldText(alias));
    next = stripMarker(next, foldText(alias).replace(/\s+/g, ""));
  }
  return next;
}

function stripMarker(hay: string, marker: string): string {
  if (!marker) return hay;
  return hay.split(marker).join(" ");
}

function openingHay(opening: Opening): string {
  const location = opening.location ?? "";
  const requirements = opening.requirements.flatMap((requirement) => [
    requirement.label.vi,
    requirement.label.en,
    ...requirement.skills,
  ]);
  return foldText(
    [opening.title, opening.org, opening.description, location, ...requirements].join(" "),
  );
}
