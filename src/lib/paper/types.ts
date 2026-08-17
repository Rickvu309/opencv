// A paper the person builds inside OpenPath, rather than a file they keep
// elsewhere. Uploaded files live beside papers in My Paper. Vault pointers
// (LinkedIn, GitHub, portfolio) live on Profile.
//
// Paper is one artefact with a type. A CV is sections and dated entries. A
// letter is paragraphs. A Proof is a running dump of notes. Callers see
// `Paper`. See ADR 0002 and ADR 0003.

import type { DocumentLanguage, Msg } from "@/lib/i18n/locale";

export type PaperType = "cv" | "letter" | "proof";

export const paperTypes: PaperType[] = ["cv", "letter", "proof"];

export const paperTypeLabels: Record<PaperType, Msg> = {
  cv: "CV",
  letter: "Cover letter",
  proof: "Proof",
};

export type LetterSituation =
  | "posted"
  | "internship"
  | "speculative"
  | "scholarship";

export const letterSituations: LetterSituation[] = [
  "posted",
  "internship",
  "speculative",
  "scholarship",
];

export type PaperWord = "CV" | "Resume";

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

export type CvTemplate =
  | "classic"
  | "modern"
  | "compact"
  | "internship"
  | "academic"
  | "service"
  | "technical"
  | "design";

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
  type: "letter";
  situation?: LetterSituation;
  org?: string;
  to?: string;
  subject?: string;
  body: string;
};

export type ProofNoteKind = "note" | "photo" | "file" | "link";

export type ProofNote = {
  id: string;
  kind?: ProofNoteKind;
  text: string;
  url?: string;
  fileName?: string;
  at: string;
};

export type ProofPaper = PaperBase & {
  type: "proof";
  role?: string;
  dates?: string;
  link?: string;
  why?: string;
  arrangeNoteIds?: string[];
  notes: ProofNote[];
  published?: { slug: string; at: string };
};

export type Paper = CvPaper | LetterPaper | ProofPaper;

export type PaperUploadKind = "cv" | "cover-letter";

export type PaperUpload = {
  id: string;
  kind: PaperUploadKind;
  label: string;
  fileName: string;
  mime?: string;
  size?: number;
  updatedAt: string;
};

export function isCvPaper(paper: Paper): paper is CvPaper {
  return paper.type === "cv";
}

export function isLetterPaper(paper: Paper): paper is LetterPaper {
  return paper.type === "letter";
}

export function isProofPaper(paper: Paper): paper is ProofPaper {
  return paper.type === "proof";
}

export function cvsOf(papers: readonly Paper[]): CvPaper[] {
  return papers.filter(isCvPaper);
}

export function lettersOf(papers: readonly Paper[]): LetterPaper[] {
  return papers.filter(isLetterPaper);
}

export function proofsOf(papers: readonly Paper[]): ProofPaper[] {
  return papers.filter(isProofPaper);
}
