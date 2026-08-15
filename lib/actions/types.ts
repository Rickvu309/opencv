// The shape of everything the Coach is allowed to see and change.
//
// Deliberately excludes UI-local state (canvas viewport, popover open, sidebar
// width). Those are presentation concerns; the agent has no business touching
// them, and keeping them out means every field here is safe to expose as a tool.

import type { Application } from "@/lib/applications/types";
import type { VaultItemId } from "@/lib/profile/vault";
import type { Locale } from "@/lib/i18n/locale";
import type { Paper } from "@/lib/paper/types";
import type { PitchItem } from "@/lib/pitch/types";
import type { Opening } from "@/lib/search/types";

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

export type AppState = {
  /**
   * The language the app speaks, and the language the Coach answers in.
   *
   * Deliberately part of the state the Coach can see and change, rather than a
   * UI preference kept beside it. Someone who switches to English and then gets
   * a Vietnamese reply has been ignored by the half of the product that talks
   * most, and the Coach can only avoid that if it is told.
   */
  locale: Locale;
  profile: {
    identity: { name: string; targetRole: string };
    /** Label/value rows shown under the profile's context section. */
    context: { label: string; value: string }[];
    experience: Experience[];
    education: {
      school: string;
      major: string;
      year: string;
      gpa: string;
      courses: string[];
    };
    /** Every stored document, across all kinds. A kind counts as filled
     *  when at least one document exists for it. */
    documents: ProfileDocument[];
  };
  /**
   * Papers built inside OpenPath. CV, letter, and write-up are types.
   *
   * Distinct from `profile.documents` (vault pointers). A person can have both:
   * an uploaded PDF and a CV-type paper they are building here.
   */
  paper: Paper[];
  /**
   * How the user describes themselves: one bio, one self-introduction, and a
   * bank of interview answers. Separate from `papers` because these are not
   * documents anybody exports; they are lines to reuse.
   */
  pitch: PitchItem[];
  /**
   * Real postings, saved or merely pasted.
   *
   * Unlike the role catalogue in `lib/catalogue/`, which is the same list
   * for everybody, these belong to the person: what they found, what they
   * pasted, what they saved. See `lib/search/types.ts`.
   */
  openings: Opening[];
  /**
   * The applications made from saved openings.
   *
   * Separate from `openings` because they have different lifetimes: an opening
   * stops existing when the posting closes, and the record of having applied to
   * it does not.
   */
  applications: Application[];
};
