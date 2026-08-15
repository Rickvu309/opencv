// Making a CV exist: blank, or filled from what the profile already knows.

import type { AppState } from "@/lib/actions/types";
import { matchesMsg, type DocumentLanguage } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import {
  defaultTheme,
  isProseKind,
  sectionDefaults,
  sectionOrder,
  starterSections,
  type Resume,
  type ResumeEntry,
  type ResumeSection,
  type ResumeSectionKind,
} from "./types";

/**
 * The next free id under a prefix.
 *
 * Counting the list would reuse an id after a removal, and ids are what every
 * edit action targets: reusing one means an edit aimed at a deleted entry
 * silently lands on its replacement. So this reads the highest suffix in use
 * rather than the length.
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

export function emptySection(
  kind: ResumeSectionKind,
  id: string,
  _language: DocumentLanguage,
  heading?: string,
): ResumeSection {
  return {
    id,
    kind,
    heading: heading ?? sectionDefaults[kind].heading,
    ...(isProseKind(kind) ? { body: "" } : {}),
    entries: [],
  };
}

/** Where a newly added section belongs, by the order a CV reads best in. */
export function insertionIndex(
  sections: ResumeSection[],
  kind: ResumeSectionKind,
): number {
  const rank = sectionOrder.indexOf(kind);
  const after = sections.findIndex(
    (s) => sectionOrder.indexOf(s.kind) > rank,
  );
  return after === -1 ? sections.length : after;
}

/**
 * A blank CV, with its sections already named.
 *
 * Named-but-empty rather than genuinely empty: an editor that opens on nothing
 * asks the user to invent the structure of a CV, which is the part they came
 * here not to have to know.
 */
export function blankResume(id: string, label: string, language: DocumentLanguage): Resume {
  return {
    id,
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

/**
 * A CV built from the profile the user has already filled in.
 *
 * This is the point of keeping the profile structured: everything here was
 * typed once, during onboarding or on the profile screen, and retyping it into
 * a CV is work the product exists to remove. Anything the profile does not know
 * is left blank rather than invented, so the user is editing their own words.
 */
export function resumeFromProfile(
  state: AppState,
  id: string,
  label: string,
  language: DocumentLanguage,
): Resume {
  const { profile } = state;
  const resume = blankResume(id, label, language);

  resume.targetRole = profile.identity.targetRole || undefined;
  resume.header = {
    ...resume.header,
    name: profile.identity.name,
    headline: [profile.education.year, profile.identity.targetRole]
      .filter(Boolean)
      .join(" · "),
    // Matched in either language: the row was labelled in whichever language
    // the user was reading when it was written, which may not be this one.
    location:
      profile.context.find(
        (r) =>
          matchesMsg(messages.context.location, r.label) ||
          r.label.trim().toLowerCase() === "địa điểm",
      )?.value ?? "",
  };

  const sections: ResumeSection[] = [];
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

  resume.sections = sections;
  return resume;
}

export function blankEntry(id: string): ResumeEntry {
  return { id, title: "" };
}
