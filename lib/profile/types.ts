import type { VaultItemId } from "./vault";

export type Experience = {
  title: string;
  org: string;
  period: string;
  detail: string;
};

/**
 * One stored document. A profile keeps many per kind, a CV tailored for Data
 * Analyst, another for BA, an English one, and exactly one per kind is
 * primary: the version the Coach reads and the one shown first.
 */
export type ProfileDocument = {
  id: string;
  kind: VaultItemId;
  /** What the user calls this version, e.g. "CV, Data Analyst". */
  label: string;
  /** What it's tailored for. The reason this version exists. */
  purpose?: string;
  targetRole?: string;
  language: "vi" | "en";
  /** Link-backed documents (LinkedIn, GitHub, hosted portfolio). */
  url?: string;
  /** File-backed documents (CV, cover letter). */
  fileName?: string;
  note?: string;
  isPrimary: boolean;
  /** Display strings, not timestamps; no clock skew between server and client. */
  updatedAt: string;
  syncedAt?: string;
};
