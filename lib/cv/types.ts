// A CV the user builds inside OpenPath, rather than a file they keep elsewhere.
//
// `ProfileDocument` (lib/actions/types.ts) is a *pointer*: a label, a purpose, a
// filename or URL for a CV that lives on someone's disk. This is the document
// itself, structured enough that the Coach can edit one line of it and a
// template can lay it out. The two coexist on purpose: an uploaded PDF is still
// a real CV, and a built one is not a replacement for it.

import type { Locale, Msg } from "@/lib/i18n/locale";

/**
 * What a section is for. The kind decides how it is laid out and what the
 * editor offers, so it is a closed set rather than free text.
 *
 * `summary` and `skills` carry prose in `body`; the rest carry `entries`.
 * `custom` carries entries too, and exists so a user can add "Giải thưởng" or
 * "Hoạt động" without waiting for us to name it.
 */
export type ResumeSectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "custom";

/** Kinds whose content is prose, not a list of dated entries. */
export const PROSE_KINDS: ResumeSectionKind[] = ["summary", "skills"];

export function isProseKind(kind: ResumeSectionKind): boolean {
  return PROSE_KINDS.includes(kind);
}

/** One dated thing: a job, a degree, a project, a certificate. */
export type ResumeEntry = {
  id: string;
  /** Role, degree, project name. The line that carries the most weight. */
  title: string;
  /** Company, school, publisher. */
  org?: string;
  period?: string;
  location?: string;
  /** One bullet per line. Rendered as a list, stored as text so the editor can
   *  stay a single textarea and paste from anywhere keeps its shape. */
  detail?: string;
  url?: string;
};

export type ResumeSection = {
  id: string;
  kind: ResumeSectionKind;
  /** The user's own wording. Defaults come from `sectionDefaults`. */
  heading: string;
  /** Prose kinds only. */
  body?: string;
  entries: ResumeEntry[];
  /** Kept but not printed. Cheaper than deleting when tailoring per application. */
  hidden?: boolean;
};

export type ResumeLink = { label: string; url: string };

export type ResumeHeader = {
  name: string;
  /** The line under the name: "Sinh viên năm 3, hướng Data Analyst". */
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: ResumeLink[];
};

export type ResumeTemplate = "classic" | "modern" | "compact";
export type ResumeAccent = "ink" | "blue" | "green" | "plum";
export type ResumeDensity = "airy" | "normal" | "tight";

export type ResumeTheme = {
  template: ResumeTemplate;
  accent: ResumeAccent;
  density: ResumeDensity;
};

export const defaultTheme: ResumeTheme = {
  template: "classic",
  accent: "ink",
  density: "normal",
};

export type Resume = {
  id: string;
  /** What the user calls this version: "CV, Data Analyst". */
  label: string;
  /** The job this version is aimed at. Drives the Coach's tailoring. */
  targetRole?: string;
  /**
   * The language of the *document*, which is not necessarily the language of
   * the app. Section headings and the Coach's rewrites follow this.
   */
  language: Locale;
  header: ResumeHeader;
  sections: ResumeSection[];
  theme: ResumeTheme;
  /** Display string, not a timestamp; no clock skew between server and client. */
  updatedAt: string;
};

/**
 * Default heading and editor hint per kind, in both languages.
 *
 * The heading is *document content*, not interface copy, so it follows the CV's
 * own `language` rather than the app's: someone reading OpenPath in Vietnamese
 * while writing an English CV for an international employer needs "Experience"
 * on the page and Vietnamese around it. The hint is interface copy and follows
 * the app, which is why the two are read with different locales at the call
 * site rather than bundled into one lookup.
 */
export const sectionDefaults: Record<
  ResumeSectionKind,
  { heading: Msg; hint: Msg }
> = {
  summary: {
    heading: { vi: "Giới thiệu", en: "Summary" },
    hint: {
      vi: "Ba câu: bạn là ai, làm được gì, đang tìm gì.",
      en: "Three sentences: who you are, what you can do, what you want.",
    },
  },
  experience: {
    heading: { vi: "Kinh nghiệm", en: "Experience" },
    hint: {
      vi: "Thực tập, việc làm thêm, câu lạc bộ. Mỗi dòng một kết quả.",
      en: "Internships, part-time work, clubs. One result per bullet.",
    },
  },
  education: {
    heading: { vi: "Học vấn", en: "Education" },
    hint: {
      vi: "Trường, chuyên ngành, thời gian.",
      en: "School, field of study, dates.",
    },
  },
  skills: {
    heading: { vi: "Kỹ năng", en: "Skills" },
    hint: {
      vi: "Nhóm theo loại: ngôn ngữ, công cụ, kỹ năng mềm.",
      en: "Group them: languages, tools, ways of working.",
    },
  },
  projects: {
    heading: { vi: "Dự án", en: "Projects" },
    hint: {
      vi: "Tên dự án, bạn làm gì, kết quả ra sao.",
      en: "What it was, what you did, what came of it.",
    },
  },
  certifications: {
    heading: { vi: "Chứng chỉ", en: "Certificates" },
    hint: {
      vi: "Tên chứng chỉ, nơi cấp, năm.",
      en: "Name, who issued it, year.",
    },
  },
  custom: {
    heading: { vi: "Mục mới", en: "New section" },
    hint: { vi: "Đặt tên cho mục này.", en: "Give this section a name." },
  },
};

/** The order a CV reads best in, used when a section is added. */
export const sectionOrder: ResumeSectionKind[] = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "custom",
];

/** Sections a new CV starts with. Empty, but named, so the page is never blank. */
export const starterSections: ResumeSectionKind[] = [
  "summary",
  "experience",
  "education",
  "skills",
];

/** One bullet per non-empty line. */
export function bullets(detail: string | undefined): string[] {
  if (!detail) return [];
  return detail
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * How full this CV is, 0–100, so the editor can say what is still missing
 * rather than only showing an empty page. Weighted by what a reader looks at
 * first: a nameless CV scores nothing regardless of how many bullets it has.
 */
export function resumeCompleteness(resume: Resume): number {
  const { header } = resume;
  let score = 0;
  if (header.name.trim()) score += 15;
  if (header.headline.trim()) score += 5;
  if (header.email.trim() || header.phone.trim()) score += 10;

  const visible = resume.sections.filter((s) => !s.hidden);
  const filled = (section: ResumeSection) =>
    isProseKind(section.kind)
      ? Boolean(section.body?.trim())
      : section.entries.some((e) => e.title.trim());

  const withContent = visible.filter(filled).length;
  // Four filled sections is a complete CV; more is detail, not completeness.
  score += Math.min(withContent, 4) * 15;

  // One measurable bullet somewhere is the difference between a CV that lists
  // duties and one that shows results.
  const hasBullets = visible.some((s) =>
    s.entries.some((e) => bullets(e.detail).length > 0),
  );
  if (hasBullets) score += 10;

  return Math.min(100, score);
}
