// A paper the person builds inside OpenPath, rather than a file they keep
// elsewhere. Vault pointers live on Profile. This is the document itself.
//
// Paper is one artefact with a type. A CV is sections and dated entries. A
// letter is paragraphs. Callers see `Paper`. CV theme, section defaults, and
// paragraph helpers live next to the layouts. See ADR 0002.

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
export type CvAccent = "ink" | "blue" | "green" | "plum";
export type CvDensity = "airy" | "normal" | "tight";

export type CvTheme = {
  template: CvTemplate;
  accent: CvAccent;
  density: CvDensity;
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
