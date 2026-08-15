/**
 * A real job opening, as opposed to a role archetype.
 *
 * ## Where these come from
 *
 * Pasted, mostly. The blueprint's later ambition is a live feed, and this
 * version deliberately does not build one: a scraping pipeline is weeks of work
 * whose failure mode is a stale list nobody trusts. What a student actually
 * does today is find a posting on Facebook or LinkedIn, and the thing they need
 * is to know whether it is worth their afternoon. So the source is a paste box
 * and a small seed set, behind a model a feed can fill later without any
 * consumer changing.
 *
 * ## Why requirements are `Requirement`, the same type the fit calculator uses
 *
 * So Fit Scoring can be pointed at an opening with no new scoring logic. A
 * requirement line the parser cannot tie to a skill gets `skills: []`, which
 * the calculator already treats as unprovable and leaves out of the
 * denominator. That is AC-SEARCH-003.4 falling out of a decision made long
 * before this feature existed, rather than a special case written for it.
 */

import type { Requirement } from "@/lib/catalogue";
import type { Msg } from "@/lib/i18n/locale";

export type Opening = {
  id: string;
  title: string;
  org: string;
  /** The posting, as the user pasted it or as the seed wrote it. */
  description: string;
  requirements: Requirement[];
  location?: string;
  link?: string;
  /** Saved openings are the ones My Applications can act on. */
  saved?: boolean;
  /** Seeded openings are examples; the user's own are not. */
  seeded?: boolean;
  addedAt: number;
};

/** The saved ones, which is what My Applications reads. */
export function savedOpenings(openings: readonly Opening[]): Opening[] {
  return openings.filter((opening) => opening.saved);
}

export function openingById(
  openings: readonly Opening[],
  id: string,
): Opening | undefined {
  return openings.find((opening) => opening.id === id);
}

/**
 * The skill vocabulary a pasted requirement line is read against.
 *
 * Deliberately short and concrete. Every entry is something that can appear in
 * somebody's course list or job title, because that is what the fit calculator
 * matches against; a vocabulary full of "communication" and "teamwork" would
 * produce requirements nobody can evidence and a fit score that means nothing.
 */
export const SKILL_VOCABULARY: Record<string, string[]> = {
  sql: ["sql"],
  python: ["python"],
  r: ["r studio", "rstudio"],
  excel: ["excel", "google sheets", "spreadsheet"],
  "power bi": ["power bi", "powerbi"],
  tableau: ["tableau"],
  looker: ["looker"],
  "google analytics": ["google analytics", "ga4"],
  dashboard: ["dashboard", "báo cáo"],
  etl: ["etl", "airflow", "data pipeline"],
  statistics: ["statistic", "thống kê", "xác suất"],
  "machine learning": ["machine learning", "học máy"],
  figma: ["figma"],
  javascript: ["javascript", "typescript"],
  react: ["react", "next.js", "nextjs"],
  marketing: ["marketing", "seo", "content"],
  english: ["ielts", "toeic", "tiếng anh", "english"],
};

/** The lines of a pasted posting that read like requirements. */
function requirementLines(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*·–]\s*/, "").trim())
    .filter((line) => line.length > 2);

  // A posting usually has a requirements heading. When it does, take what
  // follows it; when it does not, take the bulleted lines, which is what a
  // requirements list looks like without a heading.
  const heading = lines.findIndex((line) =>
    /^(yêu cầu|requirement|qualification|what you.{0,5}ll need|kỹ năng)/i.test(line),
  );
  if (heading >= 0) {
    const after = lines.slice(heading + 1);
    const stop = after.findIndex((line) =>
      /^(quyền lợi|benefit|phúc lợi|about us|liên hệ|how to apply)/i.test(line),
    );
    return (stop >= 0 ? after.slice(0, stop) : after).slice(0, 12);
  }
  return text
    .split(/\r?\n/)
    .filter((line) => /^\s*[-•*·–]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-•*·–]\s*/, "").trim())
    .slice(0, 12);
}

/** The skills a requirement line names, if any. */
function skillsIn(line: string): string[] {
  const haystack = line.toLowerCase();
  return Object.entries(SKILL_VOCABULARY)
    .filter(([, terms]) => terms.some((term) => haystack.includes(term)))
    .map(([skill]) => skill);
}

/**
 * Turn a pasted posting into an `Opening`.
 *
 * Best effort by design. What it cannot work out it leaves blank rather than
 * inventing, and every field it guesses is editable afterwards, because a
 * parser that quietly gets the company wrong is worse than one that asks.
 */
export const MIN_POSTING_CHARS = 20;

export function parseOpening(
  text: string,
  now: number = Date.now(),
): Opening | null {
  const trimmed = text.trim();
  // A real posting has a title and at least one other thing in it. Anything
  // shorter is a stray paste, and turning it into a row the user then has to
  // find and delete is worse than declining it.
  if (trimmed.length < MIN_POSTING_CHARS) return null;

  const link = /https?:\/\/\S+/.exec(trimmed)?.[0];
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // A pasted posting almost always leads with the job title, and often has the
  // company on the next line or after a dash on the first.
  const first = lines[0] ?? "";
  const dashed = first.split(/\s+[-–—|@]\s+/);
  const title = (dashed[0] || "Position").slice(0, 120);
  const org = (dashed[1] ?? lines[1] ?? "").slice(0, 120);

  const requirements: Requirement[] = requirementLines(trimmed).map((line) => ({
    label: line ,
    skills: skillsIn(line),
  }));

  return {
    // Time-based rather than random: two openings added in the same
    // millisecond would be an unusual afternoon.
    id: `opening-${now}-${title.slice(0, 12).replace(/\W+/g, "")}`,
    title,
    org,
    description: trimmed.slice(0, 8_000),
    requirements,
    link,
    addedAt: now,
  };
}

const req = (en: string, ...skills: string[]): Requirement => ({
  label: en,
  skills,
});

/**
 * A few real-shaped openings so the list is not empty on first use.
 *
 * Marked `seeded` so the interface can say what they are. An empty search
 * screen teaches nothing; four examples show what a good posting looks like
 * and what the fit read is for.
 */
export const SEED_OPENINGS: Opening[] = [
  {
    id: "seed-da-intern",
    title: "Data Analyst Intern",
    org: "Data analytics firm",
    description:
      "Data analysis intern supporting the marketing team with weekly reports and sales data cleanup.",
    requirements: [
      req("Basic SQL, queries and joins", "sql"),
      req("Excel or Google Sheets", "excel"),
      req("Can build a dashboard", "dashboard"),
      req("Curious, asks questions"),
    ],
    location: "Hanoi",
    seeded: true,
    addedAt: 0,
  },
  {
    id: "seed-ba-junior",
    title: "Junior Business Analyst",
    org: "Software company",
    description:
      "Work with the product team to clarify requirements, write documentation, and track numbers after release.",
    requirements: [
      req("SQL to check your own numbers", "sql"),
      req("Excel and presenting numbers", "excel"),
      req("English for reading documents", "english"),
      req("Writes clearly"),
    ],
    location: "Ho Chi Minh City",
    seeded: true,
    addedAt: 0,
  },
  {
    id: "seed-mkt-analyst",
    title: "Marketing Analyst",
    org: "Retail chain",
    description:
      "Measure campaign performance, build recurring reports, and recommend budget changes.",
    requirements: [
      req("Google Analytics", "google analytics"),
      req("Advanced Excel", "excel"),
      req("Understands marketing metrics", "marketing"),
      req("Power BI or Tableau", "power bi", "tableau"),
    ],
    location: "Hanoi",
    seeded: true,
    addedAt: 0,
  },
  {
    id: "seed-de-junior",
    title: "Junior Data Engineer",
    org: "Fintech company",
    description:
      "Build and maintain data pipelines so data reaches the warehouse on time and in the right shape.",
    requirements: [
      req("Python", "python"),
      req("SQL and query tuning", "sql"),
      req("Understands ETL or Airflow", "etl"),
      req("Careful with data"),
    ],
    location: "Hanoi",
    seeded: true,
    addedAt: 0,
  },
];
