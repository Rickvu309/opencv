import type { PaperUpload } from "./types";
import {
  isCvPaper,
  isLetterPaper,
  isProofPaper,
  type CvPaper,
  type LetterPaper,
  type Paper,
  type ProofPaper,
} from "./types";

/**
 * Lift an older AppState blob (`resumes` + `papers`) into `paper[]`.
 *
 * One-shot. After this, callers only read `paper`. Ids are kept so photos
 * still match. Old letter `kind` values become `type`. A write-up becomes a
 * Proof whose old text is the first note. Every item is normalised so a CV
 * stored without `type` still comes out as `type: "cv"`.
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
      const proof = asProofPaper(item);
      if (proof) {
        add(proof);
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

export function uploadsFromLegacy(raw: {
  uploads?: unknown;
  profile?: unknown;
}): PaperUpload[] {
  if (Array.isArray(raw.uploads)) {
    return raw.uploads.filter(isUpload);
  }

  const profile = isRecord(raw.profile) ? raw.profile : null;
  const documents = profile && Array.isArray(profile.documents) ? profile.documents : [];
  const out: PaperUpload[] = [];
  for (const item of documents) {
    if (!isRecord(item)) continue;
    if (item.kind !== "cv" && item.kind !== "cover-letter") continue;
    const fileName = typeof item.fileName === "string" ? item.fileName : "";
    const label =
      typeof item.label === "string" && item.label.trim()
        ? item.label
        : fileName || (item.kind === "cv" ? "CV" : "Cover letter");
    out.push({
      id: typeof item.id === "string" ? item.id : `upload-${out.length + 1}`,
      kind: item.kind,
      label,
      fileName,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "Just now",
    });
  }
  return out;
}

function dropMovedDocuments(profile: unknown): unknown {
  if (!isRecord(profile) || !Array.isArray(profile.documents)) return profile;
  return {
    ...profile,
    documents: profile.documents.filter(
      (item) =>
        !isRecord(item) || (item.kind !== "cv" && item.kind !== "cover-letter"),
    ),
  };
}

export function migrateStateShape<T extends Record<string, unknown>>(
  raw: T,
): T & { paper: Paper[]; uploads: PaperUpload[] } {
  // A present `paper` that is not an array is corruption, not an older shape.
  // Leave it so `looksLikeState` refuses rather than silently emptying it.
  if ("paper" in raw && raw.paper !== undefined && !Array.isArray(raw.paper)) {
    return raw as T & { paper: Paper[]; uploads: PaperUpload[] };
  }
  const paper = papersFromLegacy(raw);
  const uploads = uploadsFromLegacy(raw);
  const { resumes: _r, papers: _p, ...rest } = raw;
  return {
    ...rest,
    profile: dropMovedDocuments(raw.profile),
    paper,
    uploads,
  } as T & { paper: Paper[]; uploads: PaperUpload[] };
}

function asCvPaper(value: unknown): CvPaper | null {
  if (!isRecord(value) || !Array.isArray(value.sections) || !isRecord(value.header)) {
    return null;
  }
  if (
    value.type === "letter" ||
    value.type === "write-up" ||
    value.type === "proof"
  ) {
    return null;
  }
  const { type: _t, ...rest } = value;
  return { ...(rest as unknown as CvPaper), type: "cv" };
}

function asLetterPaper(value: unknown): LetterPaper | null {
  if (!isRecord(value) || typeof value.body !== "string") return null;
  if (value.type === "proof" || value.type === "write-up") return null;
  if (value.kind === "project-write-up") return null;
  if (value.type === "letter" || value.kind === "cover-letter") {
    const { kind: _k, type: _t, ...rest } = value;
    return { ...(rest as unknown as LetterPaper), type: "letter" };
  }
  return null;
}

function asProofPaper(value: unknown): ProofPaper | null {
  if (!isRecord(value)) return null;
  if (value.type === "proof" && Array.isArray(value.notes)) {
    return value as unknown as ProofPaper;
  }
  if (value.type === "write-up" || value.kind === "project-write-up") {
    const body = typeof value.body === "string" ? value.body.trim() : "";
    const { kind: _k, type: _t, body: _b, ...rest } = value;
    const notes =
      body.length > 0
        ? [
            {
              id: `${typeof value.id === "string" ? value.id : "proof"}-n-1`,
              text: body,
              at:
                typeof value.updatedAt === "string" ? value.updatedAt : "Just now",
            },
          ]
        : [];
    return {
      ...(rest as unknown as Omit<ProofPaper, "type" | "notes">),
      type: "proof",
      notes,
    };
  }
  return null;
}

function isUpload(value: unknown): value is PaperUpload {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.kind === "cv" || value.kind === "cover-letter") &&
    typeof value.label === "string" &&
    typeof value.fileName === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { isCvPaper, isLetterPaper, isProofPaper };
