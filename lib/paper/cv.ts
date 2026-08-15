// Making a CV-type paper exist: blank, or filled from what the profile already knows.

import type { AppState } from "@/lib/actions/types";
import { matchesMsg, type DocumentLanguage } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import {
  defaultTheme,
  isProseKind,
  nextId,
  sectionDefaults,
  sectionOrder,
  starterSections,
  type CvEntry,
  type CvPaper,
  type CvSection,
  type CvSectionKind,
} from "./types";

export { nextId };

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
