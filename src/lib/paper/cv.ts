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
  PaperWord,
} from "./types";

export const PROSE_KINDS: CvSectionKind[] = ["summary", "skills"];

export function isProseKind(kind: CvSectionKind): boolean {
  return PROSE_KINDS.includes(kind);
}

export const templates: CvTemplate[] = [
  "classic",
  "internship",
  "academic",
  "service",
  "compact",
  "modern",
  "technical",
  "design",
];

export const templatesWithPhoto: CvTemplate[] = [
  "classic",
  "internship",
  "service",
];

export function templateHasPhoto(template: CvTemplate): boolean {
  return templatesWithPhoto.includes(template);
}

export function wordForTemplate(template: CvTemplate): PaperWord {
  return template === "modern" || template === "technical" || template === "design"
    ? "Resume"
    : "CV";
}

export const defaultTheme: CvTheme = {
  template: "classic",
  accent: "ink",
  density: "normal",
};

export const themeForTemplate: Record<CvTemplate, CvTheme> = {
  classic: { template: "classic", accent: "ink", density: "normal" },
  internship: { template: "internship", accent: "ink", density: "normal" },
  academic: { template: "academic", accent: "ink", density: "airy" },
  service: { template: "service", accent: "ink", density: "normal" },
  compact: { template: "compact", accent: "ink", density: "tight" },
  modern: { template: "modern", accent: "ink", density: "normal" },
  technical: { template: "technical", accent: "ink", density: "normal" },
  design: { template: "design", accent: "blue", density: "normal" },
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

const sectionOrderByTemplate: Record<CvTemplate, CvSectionKind[]> = {
  classic: [
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "custom",
  ],
  internship: [
    "education",
    "projects",
    "experience",
    "skills",
    "summary",
    "certifications",
    "custom",
  ],
  academic: [
    "education",
    "projects",
    "certifications",
    "skills",
    "experience",
    "summary",
    "custom",
  ],
  service: [
    "experience",
    "skills",
    "education",
    "summary",
    "projects",
    "certifications",
    "custom",
  ],
  compact: [
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "custom",
  ],
  modern: [
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "custom",
  ],
  technical: [
    "skills",
    "projects",
    "experience",
    "education",
    "summary",
    "certifications",
    "custom",
  ],
  design: [
    "projects",
    "skills",
    "experience",
    "education",
    "summary",
    "certifications",
    "custom",
  ],
};

export function sectionOrderFor(template: CvTemplate): CvSectionKind[] {
  return sectionOrderByTemplate[template];
}

export const starterSections: CvSectionKind[] = [
  "summary",
  "experience",
  "education",
  "skills",
];

const starterByTemplate: Record<CvTemplate, CvSectionKind[]> = {
  classic: ["summary", "experience", "education", "skills"],
  internship: ["education", "projects", "experience", "skills"],
  academic: ["education", "projects", "certifications", "skills"],
  service: ["experience", "skills", "education", "summary"],
  compact: ["summary", "experience", "education", "skills"],
  modern: ["summary", "experience", "education", "skills"],
  technical: ["skills", "projects", "experience", "education"],
  design: ["projects", "skills", "experience", "education"],
};

export function starterSectionsFor(template: CvTemplate): CvSectionKind[] {
  return starterByTemplate[template];
}

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

/** Sections that belong on the printed page. Hidden and empty stay off it. */
export function printableSections(paper: CvPaper): CvSection[] {
  return paper.sections.filter((section) => {
    if (section.hidden) return false;
    return isProseKind(section.kind)
      ? Boolean(section.body?.trim())
      : section.entries.some((e) => e.title.trim() || e.detail?.trim());
  });
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
  template: CvTemplate = "classic",
): number {
  const order = sectionOrderFor(template);
  const rank = order.indexOf(kind);
  const after = sections.findIndex((s) => order.indexOf(s.kind) > rank);
  return after === -1 ? sections.length : after;
}

export function blankCv(
  id: string,
  label: string,
  language: DocumentLanguage,
  template: CvTemplate = "classic",
): CvPaper {
  const theme = { ...themeForTemplate[template] };
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
    sections: starterSectionsFor(template).map((kind, i) =>
      emptySection(kind, `${id}-s-${i + 1}`, language),
    ),
    theme,
    updatedAt: "Just now",
  };
}

export function cvFromProfile(
  state: AppState,
  id: string,
  label: string,
  language: DocumentLanguage,
  template: CvTemplate = "classic",
): CvPaper {
  const { profile } = state;
  const paper = blankCv(id, label, language, template);

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

  const fill = (kind: CvSectionKind, edit: (section: CvSection) => void) => {
    const section = paper.sections.find((s) => s.kind === kind);
    if (section) edit(section);
  };

  fill("experience", (experience) => {
    experience.entries = profile.experience.map((x, i) => ({
      id: `${experience.id}-${i + 1}`,
      title: x.title,
      org: x.org,
      period: x.period,
      detail: x.detail,
    }));
  });

  fill("education", (education) => {
    if (!profile.education.school) return;
    education.entries = [
      {
        id: `${education.id}-1`,
        title: profile.education.major || profile.education.school,
        org: profile.education.major ? profile.education.school : undefined,
        period: profile.education.year,
        detail: profile.education.gpa ? `GPA ${profile.education.gpa}` : "",
      },
    ];
  });

  if (profile.education.courses.length > 0) {
    let certs = paper.sections.find((s) => s.kind === "certifications");
    if (!certs) {
      certs = emptySection(
        "certifications",
        `${id}-s-${paper.sections.length + 1}`,
        language,
      );
      paper.sections.splice(
        insertionIndex(paper.sections, "certifications", template),
        0,
        certs,
      );
    }
    certs.entries = profile.education.courses.map((name, i) => ({
      id: `${certs.id}-${i + 1}`,
      title: name,
    }));
  }

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
