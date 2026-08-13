// The shape of everything the Coach is allowed to see and change.
//
// Deliberately excludes UI-local state (canvas viewport, popover open, sidebar
// width). Those are presentation concerns; the agent has no business touching
// them, and keeping them out means every field here is safe to expose as a tool.

import type { PathEdge, PathNode } from "@/lib/career-graph";
import type { PlanKind, PlanResource, Todo, VaultItemId } from "@/lib/catalog";
import type { Resume } from "@/lib/cv/types";
import type { Locale } from "@/lib/i18n/locale";
import type { ProseDocument } from "@/lib/papers/types";
import type { PitchItem } from "@/lib/pitch/types";

/** One thing to do. Courses carry a resource; projects and tasks do not. */
export type PlanEntry = {
  id: string;
  title: string;
  detail?: string;
  kind: PlanKind;
  effort: string;
  done: boolean;
  /** Which skill gap it closes. */
  skill?: string;
  resource?: PlanResource;
};

export type PlanStage = {
  id: string;
  label: string;
  period: string;
  entries: PlanEntry[];
};

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
  todos: Todo[];
  /**
   * The plan the Coach can build. One uniform entry shape; no special cases
   * for milestones or headings, so `plan.addEntry` is the only thing the
   * agent has to learn to extend it.
   */
  plan: { stages: PlanStage[] };
  /**
   * CVs built inside OpenPath, content and all.
   *
   * Distinct from `profile.documents`, which only ever points at a file the
   * user keeps somewhere else. A person can have both: an uploaded PDF from
   * last year and a version they are building here now.
   */
  resumes: Resume[];
  /**
   * Cover letters and project write-ups, built here.
   *
   * Beside `resumes` rather than inside it: a résumé is sections and dated
   * entries, these are paragraphs, and the one model that covered both would
   * fit neither. See `lib/papers/types.ts`.
   */
  papers: ProseDocument[];
  /**
   * How the user describes themselves: one bio, one self-introduction, and a
   * bank of interview answers. Separate from `papers` because these are not
   * documents anybody exports; they are lines to reuse.
   */
  pitch: PitchItem[];
  paths: {
    targetId: string | null;
    customNodes: PathNode[];
    customEdges: PathEdge[];
  };
};
