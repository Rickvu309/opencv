// Making a CV-type paper exist: blank, or filled from what the profile already knows.

import type { AppState } from "@/lib/actions/types";
import { matchesMsg, type DocumentLanguage, type Msg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import type {
  CvEntry,
  CvHeader,
  CvPaper,
  CvSection,
  CvSectionKind,
  CvTemplate,
  CvTheme,
} from "./types";

export const PROSE_KINDS: CvSectionKind[] = ["summary", "skills"];

export function isProseKind(kind: CvSectionKind): boolean {
  return PROSE_KINDS.includes(kind);
}

export const templates: CvTemplate[] = ["classic", "modern", "compact"];
export const templatesWithPhoto: CvTemplate[] = ["classic"];

export function templateHasPhoto(template: CvTemplate): boolean {
  return templatesWithPhoto.includes(template);
}

export const defaultTheme: CvTheme = {
  template: "classic",
  accent: "ink",
  density: "normal",
};

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

export function emptySection(
  kind: CvSectionKind,
  id: string,
  _language: DocumentLanguage,
  heading?: string,
): CvSection {
  return {
    id,
    kind,
    heading: heading ?? sectionDefaults[kind].heading,
    ...(isProseKind(kind) ? { body: "" } : {}),
    entries: [],
  };
}

export function insertionIndex(
  sections: CvSection[],
  kind: CvSectionKind,
): number {
  const rank = sectionOrder.indexOf(kind);
  const after = sections.findIndex((s) => sectionOrder.indexOf(s.kind) > rank);
  return after === -1 ? sections.length : after;
}

export function blankCv(
  id: string,
  label: string,
  language: DocumentLanguage,
): CvPaper {
  return {
    id,
    type: "cv",
    label,
    language,
    header: {
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      links: [],
    },
    sections: starterSections.map((kind, i) =>
      emptySection(kind, `${id}-s-${i + 1}`, language),
    ),
    theme: { ...defaultTheme },
    updatedAt: "Just now",
  };
}

export function cvFromProfile(
  state: AppState,
  id: string,
  label: string,
  language: DocumentLanguage,
): CvPaper {
  const { profile } = state;
  const paper = blankCv(id, label, language);

  paper.targetRole = profile.identity.targetRole || undefined;
  paper.header = {
    ...paper.header,
    name: profile.identity.name,
    headline: [profile.education.year, profile.identity.targetRole]
      .filter(Boolean)
      .join(" · "),
    location:
      profile.context.find(
        (r) =>
          matchesMsg(messages.context.location, r.label) ||
          r.label.trim().toLowerCase() === "địa điểm",
      )?.value ?? "",
  };

  const sections: CvSection[] = [];
  let n = 0;
  const sectionId = () => `${id}-s-${++n}`;

  sections.push(emptySection("summary", sectionId(), language));

  const experience = emptySection("experience", sectionId(), language);
  experience.entries = profile.experience.map((x, i) => ({
    id: `${experience.id}-${i + 1}`,
    title: x.title,
    org: x.org,
    period: x.period,
    detail: x.detail,
  }));
  sections.push(experience);

  const education = emptySection("education", sectionId(), language);
  if (profile.education.school) {
    education.entries = [
      {
        id: `${education.id}-1`,
        title: profile.education.major || profile.education.school,
        org: profile.education.major ? profile.education.school : undefined,
        period: profile.education.year,
        detail: profile.education.gpa ? `GPA ${profile.education.gpa}` : "",
      },
    ];
  }
  sections.push(education);

  sections.push(emptySection("skills", sectionId(), language));

  if (profile.education.courses.length > 0) {
    const certs = emptySection("certifications", sectionId(), language);
    certs.entries = profile.education.courses.map((name, i) => ({
      id: `${certs.id}-${i + 1}`,
      title: name,
    }));
    sections.push(certs);
  }

  paper.sections = sections;
  return paper;
}

export function blankEntry(id: string): CvEntry {
  return { id, title: "" };
}

export function duplicateCv(source: CvPaper, newId: string, label: string): CvPaper {
  return {
    ...source,
    id: newId,
    label,
    updatedAt: "Just now",
    sections: source.sections.map((section, i) => {
      const sectionId = `${newId}-s-${i + 1}`;
      return {
        ...section,
        id: sectionId,
        entries: section.entries.map((entry, j) => ({
          ...entry,
          id: `${sectionId}-${j + 1}`,
        })),
      };
    }),
  };
}
