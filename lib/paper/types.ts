// A paper the person builds inside OpenPath, rather than a file they keep
// elsewhere. Vault pointers live on Profile. This is the document itself.
//
// Paper is one artefact with a type. A CV is sections and dated entries. A
// letter is paragraphs. Callers see `Paper`. The two layouts stay in this
// module so neither artefact pretends to be the other. See ADR 0002.

import type { DocumentLanguage, Msg } from "@/lib/i18n/locale";

export type PaperType = "cv" | "letter" | "write-up";

export const paperTypes: PaperType[] = ["cv", "letter", "write-up"];
export const letterTypes = ["letter", "write-up"] as const;
export type LetterType = (typeof letterTypes)[number];

export const paperTypeLabels: Record<PaperType, Msg> = {
  cv: "CV",
  letter: "Cover letter",
  "write-up": "Project write-up",
};

type PaperBase = {
  id: string;
  type: PaperType;
  label: string;
  targetRole?: string;
  language: DocumentLanguage;
  updatedAt: string;
};

export type CvSectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "custom";

export const PROSE_KINDS: CvSectionKind[] = ["summary", "skills"];

export function isProseKind(kind: CvSectionKind): boolean {
  return PROSE_KINDS.includes(kind);
}

export type CvEntry = {
  id: string;
  title: string;
  org?: string;
  period?: string;
  location?: string;
  detail?: string;
  url?: string;
};

export type CvSection = {
  id: string;
  kind: CvSectionKind;
  heading: string;
  body?: string;
  entries: CvEntry[];
  hidden?: boolean;
};

export type CvLink = { label: string; url: string };

export type CvHeader = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: CvLink[];
};

export type CvTemplate = "classic" | "modern" | "compact";

export const templates: CvTemplate[] = ["classic", "modern", "compact"];
export const templatesWithPhoto: CvTemplate[] = ["classic"];

export function templateHasPhoto(template: CvTemplate): boolean {
  return templatesWithPhoto.includes(template);
}

export type CvAccent = "ink" | "blue" | "green" | "plum";
export type CvDensity = "airy" | "normal" | "tight";

export type CvTheme = {
  template: CvTemplate;
  accent: CvAccent;
  density: CvDensity;
};

export const defaultTheme: CvTheme = {
  template: "classic",
  accent: "ink",
  density: "normal",
};

export type CvPaper = PaperBase & {
  type: "cv";
  header: CvHeader;
  sections: CvSection[];
  theme: CvTheme;
  photoStamp?: string;
};

export type LetterPaper = PaperBase & {
  type: LetterType;
  body: string;
};

export type Paper = CvPaper | LetterPaper;

export function isCvPaper(paper: Paper): paper is CvPaper {
  return paper.type === "cv";
}

export function isLetterPaper(paper: Paper): paper is LetterPaper {
  return paper.type === "letter" || paper.type === "write-up";
}

export function cvsOf(papers: readonly Paper[]): CvPaper[] {
  return papers.filter(isCvPaper);
}

export function lettersOf(papers: readonly Paper[]): LetterPaper[] {
  return papers.filter(isLetterPaper);
}

export const sectionDefaults: Record<
  CvSectionKind,
  { heading: Msg; hint: Msg }
> = {
  summary: {
    heading: "Summary",
    hint: "Three sentences: who you are, what you can do, what you want.",
  },
  experience: {
    heading: "Experience",
    hint: "Internships, part-time work, clubs. One result per bullet.",
  },
  education: {
    heading: "Education",
    hint: "School, field of study, dates.",
  },
  skills: {
    heading: "Skills",
    hint: "Group them: languages, tools, ways of working.",
  },
  projects: {
    heading: "Projects",
    hint: "What it was, what you did, what came of it.",
  },
  certifications: {
    heading: "Certificates",
    hint: "Name, who issued it, year.",
  },
  custom: {
    heading: "New section",
    hint: "Give this section a name.",
  },
};

export const sectionOrder: CvSectionKind[] = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "custom",
];

export const starterSections: CvSectionKind[] = [
  "summary",
  "experience",
  "education",
  "skills",
];

export function bullets(detail: string | undefined): string[] {
  if (!detail) return [];
  return detail
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export function sectionHasContent(section: CvSection): boolean {
  return isProseKind(section.kind)
    ? Boolean(section.body?.trim())
    : section.entries.some((e) => e.title.trim());
}

export function headerHasContent(header: CvHeader): boolean {
  return Boolean(
    header.name.trim() ||
      header.headline.trim() ||
      header.email.trim() ||
      header.phone.trim() ||
      header.location.trim(),
  );
}

export function cvCompleteness(paper: CvPaper): number {
  const { header } = paper;
  let score = 0;
  if (header.name.trim()) score += 15;
  if (header.headline.trim()) score += 5;
  if (header.email.trim() || header.phone.trim()) score += 10;

  const visible = paper.sections.filter((s) => !s.hidden);
  const withContent = visible.filter(sectionHasContent).length;
  score += Math.min(withContent, 4) * 15;

  const hasBullets = visible.some((s) =>
    s.entries.some((e) => bullets(e.detail).length > 0),
  );
  if (hasBullets) score += 10;

  return Math.min(100, score);
}

export function paragraphsOf(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function bodyFrom(paragraphs: readonly string[]): string {
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n");
}

export function isEmptyLetter(paper: LetterPaper): boolean {
  return paragraphsOf(paper.body).length === 0;
}

/**
 * The next free id under a prefix.
 *
 * Counting the list would reuse an id after a removal, and ids are what every
 * edit action targets: reusing one means an edit aimed at a deleted entry
 * silently lands on its replacement.
 */
export function nextId(prefix: string, existing: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let highest = 0;
  for (const id of existing) {
    const match = id.match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${highest + 1}`;
}
