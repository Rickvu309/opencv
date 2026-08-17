import type { ProofSnapshot } from "./share";

export type ProofSpan = {
  slug: string;
  title: string;
  why?: string;
  role?: string;
  dates?: string;
  year: number;
  start: number;
  end: number;
  tick: boolean;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function monthIndex(word: string): number | null {
  const key = word.toLowerCase().replace(/\./g, "");
  return key in MONTHS ? MONTHS[key] : null;
}

function toIndex(year: number, month = 0): number {
  return year * 12 + month;
}

/** Place a Proof on the year axis from role · dates, or Publish day. */
export function spanFromSnapshot(
  slug: string,
  snapshot: ProofSnapshot,
): ProofSpan {
  const published = snapshot.publishedAt
    ? new Date(snapshot.publishedAt)
    : new Date();
  const fallbackYear = published.getUTCFullYear();
  const fallbackMonth = published.getUTCMonth();
  const parsed = parseDates(snapshot.dates ?? "");

  if (!parsed) {
    const at = toIndex(fallbackYear, fallbackMonth);
    return {
      slug,
      title: snapshot.title,
      why: snapshot.why,
      role: snapshot.role,
      dates: snapshot.dates,
      year: fallbackYear,
      start: at,
      end: at,
      tick: true,
    };
  }

  return {
    slug,
    title: snapshot.title,
    why: snapshot.why,
    role: snapshot.role,
    dates: snapshot.dates,
    year: parsed.year,
    start: parsed.start,
    end: parsed.end,
    tick: parsed.start === parsed.end,
  };
}

export function parseDates(
  value: string,
): { year: number; start: number; end: number } | null {
  const text = value.trim();
  if (!text) return null;

  const yearOnly = text.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    return { year, start: toIndex(year, 0), end: toIndex(year, 11) };
  }

  const parts = text.split(/\s*[–—-]\s*/);
  const start = parsePoint(parts[0] ?? "");
  if (!start) return null;
  if (parts.length === 1) {
    return { year: start.year, start: start.at, end: start.at };
  }
  const endWord = (parts[1] ?? "").trim();
  if (/^(now|present|nay)$/i.test(endWord)) {
    const now = new Date();
    return {
      year: start.year,
      start: start.at,
      end: toIndex(now.getUTCFullYear(), now.getUTCMonth()),
    };
  }
  const end = parsePoint(endWord, start.year);
  if (!end) return { year: start.year, start: start.at, end: start.at };
  return {
    year: start.year,
    start: start.at,
    end: Math.max(start.at, end.at),
  };
}

function parsePoint(
  value: string,
  fallbackYear?: number,
): { year: number; at: number } | null {
  const text = value.trim();
  const monthYear = text.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const month = monthIndex(monthYear[1] ?? "");
    const year = Number(monthYear[2]);
    if (month == null) return null;
    return { year, at: toIndex(year, month) };
  }
  const numeric = text.match(/^(\d{1,2})[/.](\d{4})$/);
  if (numeric) {
    const month = Math.max(0, Math.min(11, Number(numeric[1]) - 1));
    const year = Number(numeric[2]);
    return { year, at: toIndex(year, month) };
  }
  const yearOnly = text.match(/^(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    return { year, at: toIndex(year, 0) };
  }
  if (fallbackYear != null) {
    const month = monthIndex(text);
    if (month != null) return { year: fallbackYear, at: toIndex(fallbackYear, month) };
  }
  return null;
}

export function spansByYear(spans: ProofSpan[]): Map<number, ProofSpan[]> {
  const years = new Map<number, ProofSpan[]>();
  for (const span of spans) {
    const list = years.get(span.year) ?? [];
    list.push(span);
    years.set(span.year, list);
  }
  return new Map([...years.entries()].sort((a, b) => b[0] - a[0]));
}

export function yearRange(spans: readonly ProofSpan[]): {
  start: number;
  end: number;
} | null {
  if (spans.length === 0) return null;
  return {
    start: Math.min(...spans.map((span) => span.start)),
    end: Math.max(...spans.map((span) => span.end)),
  };
}

/** Identity line on the personal link. Handle stays in the URL. */
export function sentenceForSite(
  name: string | undefined,
  spans: readonly ProofSpan[],
): string {
  const who = name?.trim();
  if (!who) {
    return spans.length === 0 ? "Published work." : "Published work, dated by when it ran.";
  }
  if (spans.length === 0) return `${who} has not published work yet.`;
  const years = [...new Set(spans.map((span) => span.year))].sort((a, b) => a - b);
  const first = years[0];
  const last = years[years.length - 1];
  if (first === last) return `${who} published work in ${first}.`;
  return `${who} published work from ${first} to ${last}.`;
}
