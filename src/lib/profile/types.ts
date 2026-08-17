import type { VaultItemId } from "./vault";

export type Experience = {
  title: string;
  org: string;
  period: string;
  detail: string;
};

/**
 * One stored vault pointer. A profile keeps many per kind, a LinkedIn for
 * English and another for Vietnamese, and exactly one per kind is primary:
 * the version the Coach reads and the one shown first.
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
  /** Optional filename when a link also has a file they named. */
  fileName?: string;
  note?: string;
  isPrimary: boolean;
  /** Display strings, not timestamps; no clock skew between server and client. */
  updatedAt: string;
  syncedAt?: string;
};
