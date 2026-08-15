import {
  isCvPaper,
  isLetterPaper,
  type CvPaper,
  type LetterPaper,
  type Paper,
  type PaperType,
} from "./types";

/**
 * Lift an older AppState blob (`resumes` + `papers`) into `paper[]`.
 *
 * One-shot. After this, callers only read `paper`. Ids are kept so photos
 * still match. Old letter `kind` values become `type`. Every item is
 * normalised so a CV stored without `type` still comes out as `type: "cv"`.
 */
export function papersFromLegacy(raw: {
  resumes?: unknown;
  papers?: unknown;
  paper?: unknown;
}): Paper[] {
  const out: Paper[] = [];
  const seen = new Set<string>();

  const add = (item: Paper) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  };

  const ingest = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const cv = asCvPaper(item);
      if (cv) {
        add(cv);
        continue;
      }
      const letter = asLetterPaper(item);
      if (letter) add(letter);
    }
  };

  ingest(raw.paper);
  ingest(raw.resumes);
  ingest(raw.papers);
  return out;
}

export function migrateStateShape<T extends Record<string, unknown>>(
  raw: T,
): T & { paper: Paper[] } {
  // A present `paper` that is not an array is corruption, not an older shape.
  // Leave it so `looksLikeState` refuses rather than silently emptying it.
  if ("paper" in raw && raw.paper !== undefined && !Array.isArray(raw.paper)) {
    return raw as T & { paper: Paper[] };
  }
  const paper = papersFromLegacy(raw);
  const { resumes: _r, papers: _p, ...rest } = raw;
  return { ...rest, paper } as T & { paper: Paper[] };
}

function asCvPaper(value: unknown): CvPaper | null {
  if (!isRecord(value) || !Array.isArray(value.sections) || !isRecord(value.header)) {
    return null;
  }
  if (value.type === "letter" || value.type === "write-up") return null;
  const { type: _t, ...rest } = value;
  return { ...(rest as unknown as CvPaper), type: "cv" };
}

function asLetterPaper(value: unknown): LetterPaper | null {
  if (!isRecord(value) || typeof value.body !== "string") return null;
  const type = letterTypeOf(value);
  if (!type) return null;
  const { kind: _k, type: _t, ...rest } = value;
  return { ...(rest as unknown as LetterPaper), type };
}

function letterTypeOf(
  value: Record<string, unknown>,
): Extract<PaperType, "letter" | "write-up"> | null {
  if (value.type === "letter" || value.type === "write-up") return value.type;
  if (value.kind === "cover-letter") return "letter";
  if (value.kind === "project-write-up") return "write-up";
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { isCvPaper, isLetterPaper };
