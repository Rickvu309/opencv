import { z } from "zod";

import { defineAction, msg, type Action } from "@/lib/actions/define";
import type { AppState } from "@/lib/actions/types";
import { nextId } from "@/lib/ids";
import {
  blankCv,
  blankEntry,
  cvFromProfile,
  duplicateCv,
  emptySection,
  insertionIndex,
  sectionDefaults,
} from "@/lib/paper/cv";
import { bodyFrom, paragraphsOf } from "@/lib/paper/letter";
import {
  isCvPaper,
  isLetterPaper,
  paperTypes,
  type CvPaper,
  type CvSection,
  type LetterPaper,
  type Paper,
} from "@/lib/paper/types";

const sectionKinds = z.enum([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "custom",
]);

/**
 * Rewrite one paper, leaving every other one alone, and stamp it as just-changed.
 */
function editPaper(
  state: AppState,
  id: string,
  edit: (paper: Paper) => Paper,
): AppState {
  const target = state.paper.find((p) => p.id === id);
  if (!target) return state;
  return {
    ...state,
    paper: state.paper.map((p) =>
      p.id === id ? { ...edit(p), updatedAt: "Just now" } : p,
    ),
  };
}

function editCv(
  state: AppState,
  id: string,
  edit: (paper: CvPaper) => CvPaper,
): AppState {
  return editPaper(state, id, (paper) => (isCvPaper(paper) ? edit(paper) : paper));
}

function editLetter(
  state: AppState,
  id: string,
  edit: (paper: LetterPaper) => LetterPaper,
): AppState {
  return editPaper(state, id, (paper) =>
    isLetterPaper(paper) ? edit(paper) : paper,
  );
}

function editSection(
  state: AppState,
  paperId: string,
  sectionId: string,
  edit: (section: CvSection) => CvSection,
): AppState {
  return editCv(state, paperId, (paper) => ({
    ...paper,
    sections: paper.sections.map((s) => (s.id === sectionId ? edit(s) : s)),
  }));
}

/** Move an item within a list by a signed offset, clamped at both ends. */
function shift<T>(items: T[], index: number, by: number): T[] {
  const to = Math.max(0, Math.min(items.length - 1, index + by));
  if (index === to) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(to, 0, moved);
  return next;
}

export const paperActions = {
  // ── Paper: CVs, letters, write-ups ─────────────────────────────────────
  //
  // One artefact, two layouts. Shared actions take `type`. CV-only and
  // letter-only actions no-op on the wrong type rather than invent a second
  // artefact.

  "paper.create": defineAction({
    description:
      "Start a paper. type is cv, letter, or write-up. For a CV, fromProfile " +
      "fills it from the profile (almost always what they want). For a letter " +
      "or write-up, pass body to write the first draft, with a blank line " +
      "between paragraphs. Always give it a label naming what it is for.",
    input: z.object({
      type: z.enum(paperTypes as ["cv", "letter", "write-up"]),
      label: z.string().min(1).describe('e.g. "CV, Data Analyst" or "Letter for VNG"'),
      targetRole: z.string().optional(),
      fromProfile: z.boolean().default(true),
      body: z.string().optional(),
      language: z
        .enum(["vi", "en"])
        .optional()
        .describe("The document's own language. Defaults to English."),
    }),
    apply: (state, { type, label, targetRole, fromProfile, body, language }) => {
      const id = nextId(
        "paper",
        state.paper.map((p) => p.id),
      );
      const documentLanguage = language ?? "en";
      let created: Paper;
      if (type === "cv") {
        created = fromProfile
          ? cvFromProfile(state, id, label, documentLanguage)
          : blankCv(id, label, documentLanguage);
        if (targetRole) created.targetRole = targetRole;
      } else {
        created = {
          id,
          type,
          label,
          language: documentLanguage,
          body: body ?? "",
          updatedAt: "Just now",
        };
        if (targetRole) created.targetRole = targetRole;
      }
      return { ...state, paper: [...state.paper, created] };
    },
    summary: ({ label }) => msg(`Created “${label}”`),
    touched: (_input, after) => {
      const added = after.paper.at(-1);
      return added ? [added.id] : [];
    },
  }),

  "paper.duplicate": defineAction({
    description:
      "Copy an existing paper so the user can tailor it without losing the " +
      "original. Prefer this over creating a second one from scratch when the " +
      "two share most of their content.",
    input: z.object({
      id: z.string().min(1),
      label: z.string().min(1),
    }),
    apply: (state, { id, label }) => {
      const source = state.paper.find((p) => p.id === id);
      if (!source) return state;
      const newId = nextId(
        "paper",
        state.paper.map((p) => p.id),
      );
      const copy: Paper = isCvPaper(source)
        ? duplicateCv(source, newId, label)
        : { ...source, id: newId, label, updatedAt: "Just now" };
      return { ...state, paper: [...state.paper, copy] };
    },
    summary: ({ label }) => msg(`Duplicated as “${label}”`),
    touched: (_input, after) => {
      const added = after.paper.at(-1);
      return added ? [added.id] : [];
    },
  }),

  "paper.rename": defineAction({
    description:
      "Change what a paper is called, which job it targets, or its language.",
    input: z.object({
      id: z.string().min(1),
      label: z.string().min(1).optional(),
      targetRole: z.string().optional(),
      language: z.enum(["vi", "en"]).optional(),
    }),
    apply: (state, { id, ...fields }) =>
      editPaper(state, id, (paper) => ({ ...paper, ...fields })),
    summary: () => msg("Saved"),
  }),

  "paper.remove": defineAction({
    destructive: true,
    confirm: () => msg("Delete this paper for good? It cannot be restored."),
    description: "Delete a paper the user no longer wants.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      paper: state.paper.filter((p) => p.id !== id),
    }),
    summary: () => msg("Paper deleted"),
  }),

  "paper.setHeader": defineAction({
    description:
      "Set the contact block at the top of a CV. The headline is the one line " +
      "under the name, e.g. “Sinh viên năm 3 · hướng Data Analyst”.",
    input: z.object({
      id: z.string().min(1),
      name: z.string().optional(),
      headline: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      links: z
        .array(z.object({ label: z.string(), url: z.string() }))
        .optional()
        .describe("Replaces the whole list, e.g. LinkedIn and GitHub"),
    }),
    apply: (state, { id, ...fields }) =>
      editCv(state, id, (paper) => ({
        ...paper,
        header: { ...paper.header, ...fields },
      })),
    summary: () => msg("Contact details updated"),
  }),

  "paper.setPhoto": defineAction({
    description:
      "Record that this CV now has a photo, or that it no longer does. The " +
      "image itself is uploaded by the user through the Paper screen and is not " +
      "something you can set; this only writes down that one exists. You will " +
      "rarely need it.",
    input: z.object({
      id: z.string().min(1),
      stamp: z
        .string()
        .optional()
        .describe("Absent means the CV has no photo"),
    }),
    apply: (state, { id, stamp }) =>
      editCv(state, id, (paper) => {
        const next = { ...paper };
        if (stamp) next.photoStamp = stamp;
        else delete next.photoStamp;
        return next;
      }),
    summary: ({ stamp }) =>
      stamp ? msg("Photo added") : msg("Photo removed"),
  }),

  "paper.setTheme": defineAction({
    description:
      "Change how a CV looks: template, accent colour, and how tightly it is " +
      "packed. Use tight when the user needs to fit one page.",
    input: z.object({
      id: z.string().min(1),
      template: z.enum(["classic", "modern", "compact"]).optional(),
      accent: z.enum(["ink", "blue", "green", "plum"]).optional(),
      density: z.enum(["airy", "normal", "tight"]).optional(),
    }),
    apply: (state, { id, ...fields }) =>
      editCv(state, id, (paper) => ({
        ...paper,
        theme: { ...paper.theme, ...fields },
      })),
    summary: () => msg("CV appearance updated"),
  }),

  "paper.addSection": defineAction({
    description:
      "Add a section to a CV. It lands where that kind belongs in the reading " +
      "order rather than at the end. Use custom for anything unnamed here, " +
      "and give it a heading.",
    input: z.object({
      id: z.string().min(1).describe("The paper's id"),
      kind: sectionKinds,
      heading: z.string().optional(),
    }),
    apply: (state, { id, kind, heading }) =>
      editCv(state, id, (paper) => {
        const section = emptySection(
          kind,
          nextId(
            `${paper.id}-s`,
            paper.sections.map((s) => s.id),
          ),
          paper.language,
          heading,
        );
        const at = insertionIndex(paper.sections, kind);
        const sections = [...paper.sections];
        sections.splice(at, 0, section);
        return { ...paper, sections };
      }),
    summary: ({ kind, heading }) =>
      msg(`Added the “${heading ?? sectionDefaults[kind].heading}” section`),
  }),

  "paper.updateSection": defineAction({
    description:
      "Edit a section: rename its heading, rewrite its prose (summary and " +
      "skills use body), or hide it. Hiding keeps the content but leaves it " +
      "off the printed CV, which is how a user tailors one version per job.",
    input: z.object({
      id: z.string().min(1).describe("The paper's id"),
      sectionId: z.string().min(1),
      heading: z.string().min(1).optional(),
      body: z.string().optional(),
      hidden: z.boolean().optional(),
    }),
    apply: (state, { id, sectionId, ...fields }) =>
      editSection(state, id, sectionId, (section) => ({
        ...section,
        ...fields,
      })),
    summary: () => msg("Section saved"),
    touched: ({ sectionId }) => [sectionId],
  }),

  "paper.removeSection": defineAction({
    destructive: true,
    confirm: () => msg("Delete this CV section? Hiding it keeps the content."),
    description:
      "Delete a section and everything in it. Prefer hiding it if the user " +
      "may want it back for another application.",
    input: z.object({
      id: z.string().min(1),
      sectionId: z.string().min(1),
    }),
    apply: (state, { id, sectionId }) =>
      editCv(state, id, (paper) => ({
        ...paper,
        sections: paper.sections.filter((s) => s.id !== sectionId),
      })),
    summary: () => msg("Section deleted"),
  }),

  "paper.moveSection": defineAction({
    description:
      "Move a section up or down. Order matters: a reader spends longest on " +
      "whatever is first, so the strongest section belongs near the top.",
    input: z.object({
      id: z.string().min(1),
      sectionId: z.string().min(1),
      by: z.number().int().describe("-1 for up, 1 for down"),
    }),
    apply: (state, { id, sectionId, by }) =>
      editCv(state, id, (paper) => {
        const index = paper.sections.findIndex((s) => s.id === sectionId);
        if (index === -1) return paper;
        return { ...paper, sections: shift(paper.sections, index, by) };
      }),
    summary: () => msg("Sections reordered"),
    touched: ({ sectionId }) => [sectionId],
  }),

  "paper.addEntry": defineAction({
    description:
      "Add one job, degree, project or certificate to a section. Put each " +
      "result on its own line in detail; they become bullets. Write what " +
      "changed because of the user, with a number where there is one, not a " +
      "list of duties.",
    input: z.object({
      id: z.string().min(1).describe("The paper's id"),
      sectionId: z.string().min(1),
      title: z.string().default("").describe("Role, degree or project name"),
      org: z.string().optional().describe("Company, school or publisher"),
      period: z.string().optional().describe("e.g. 06/2025 – 09/2025"),
      location: z.string().optional(),
      detail: z.string().optional().describe("One bullet per line"),
      url: z.string().optional(),
    }),
    apply: (state, { id, sectionId, ...fields }) =>
      editSection(state, id, sectionId, (section) => ({
        ...section,
        entries: [
          ...section.entries,
          {
            ...blankEntry(
              nextId(
                sectionId,
                section.entries.map((e) => e.id),
              ),
            ),
            ...fields,
          },
        ],
      })),
    summary: ({ title }) =>
      title
        ? msg(`Added “${title}” to your CV`)
        : msg("Added an entry to your CV"),
    touched: ({ sectionId }, after) => {
      const section = after.paper
        .filter(isCvPaper)
        .flatMap((p) => p.sections)
        .find((s) => s.id === sectionId);
      const added = section?.entries.at(-1);
      return added ? [added.id] : [];
    },
  }),

  "paper.updateEntry": defineAction({
    description:
      "Rewrite one entry in a CV. This is the action to use when sharpening a " +
      "bullet: send only the fields that change.",
    input: z.object({
      id: z.string().min(1).describe("The paper's id"),
      sectionId: z.string().min(1),
      entryId: z.string().min(1),
      title: z.string().optional(),
      org: z.string().optional(),
      period: z.string().optional(),
      location: z.string().optional(),
      detail: z.string().optional(),
      url: z.string().optional(),
    }),
    apply: (state, { id, sectionId, entryId, ...fields }) =>
      editSection(state, id, sectionId, (section) => ({
        ...section,
        entries: section.entries.map((e) =>
          e.id === entryId ? { ...e, ...fields } : e,
        ),
      })),
    summary: () => msg("Entry updated"),
    touched: ({ entryId }) => [entryId],
  }),

  "paper.removeEntry": defineAction({
    destructive: true,
    confirm: () => msg("Delete this entry from the CV?"),
    description: "Remove one entry from a CV section.",
    input: z.object({
      id: z.string().min(1),
      sectionId: z.string().min(1),
      entryId: z.string().min(1),
    }),
    apply: (state, { id, sectionId, entryId }) =>
      editSection(state, id, sectionId, (section) => ({
        ...section,
        entries: section.entries.filter((e) => e.id !== entryId),
      })),
    summary: () => msg("Entry deleted"),
  }),

  "paper.moveEntry": defineAction({
    description:
      "Move an entry up or down inside its section. Most recent first is the " +
      "convention readers expect.",
    input: z.object({
      id: z.string().min(1),
      sectionId: z.string().min(1),
      entryId: z.string().min(1),
      by: z.number().int().describe("-1 for up, 1 for down"),
    }),
    apply: (state, { id, sectionId, entryId, by }) =>
      editSection(state, id, sectionId, (section) => {
        const index = section.entries.findIndex((e) => e.id === entryId);
        if (index === -1) return section;
        return { ...section, entries: shift(section.entries, index, by) };
      }),
    summary: () => msg("Entries reordered"),
    touched: ({ entryId }) => [entryId],
  }),

  "paper.setBody": defineAction({
    description:
      "Replace the whole text of a letter or write-up. Use this ONLY for a " +
      "first draft or a complete rewrite the user asked for. To change one " +
      "paragraph, use paper.updateParagraph instead: replacing the whole " +
      "document would discard anything the user typed since the last turn.",
    input: z.object({
      id: z.string().min(1),
      body: z.string().describe("Paragraphs separated by a blank line"),
    }),
    apply: (state, { id, body }) =>
      editLetter(state, id, (paper) => ({ ...paper, body })),
    summary: () => msg("Rewritten"),
  }),

  "paper.updateParagraph": defineAction({
    description:
      "Rewrite one paragraph, counting from 1. This is the action to use when " +
      "sharpening a sentence or fixing a claim: it leaves every other " +
      "paragraph exactly as the user left it.",
    input: z.object({
      id: z.string().min(1),
      index: z.number().int().min(1).describe("1 is the first paragraph"),
      text: z.string().min(1),
    }),
    apply: (state, { id, index, text }) =>
      editLetter(state, id, (paper) => {
        const paragraphs = paragraphsOf(paper.body);
        if (index > paragraphs.length) return paper;
        paragraphs[index - 1] = text;
        return { ...paper, body: bodyFrom(paragraphs) };
      }),
    summary: ({ index }) => msg(`Paragraph ${index} rewritten`),
  }),

  "paper.addParagraph": defineAction({
    description:
      "Add a paragraph. It goes at the end unless `at` names a position, " +
      "counting from 1.",
    input: z.object({
      id: z.string().min(1),
      text: z.string().min(1),
      at: z.number().int().min(1).optional().describe("1 puts it first"),
    }),
    apply: (state, { id, text, at }) =>
      editLetter(state, id, (paper) => {
        const paragraphs = paragraphsOf(paper.body);
        const position =
          at === undefined ? paragraphs.length : Math.min(at - 1, paragraphs.length);
        paragraphs.splice(position, 0, text);
        return { ...paper, body: bodyFrom(paragraphs) };
      }),
    summary: () => msg("Paragraph added"),
  }),

  "paper.removeParagraph": defineAction({
    destructive: true,
    confirm: ({ index }) => msg(`Delete paragraph ${index}?`),
    description: "Delete one paragraph, counting from 1.",
    input: z.object({
      id: z.string().min(1),
      index: z.number().int().min(1),
    }),
    apply: (state, { id, index }) =>
      editLetter(state, id, (paper) => {
        const paragraphs = paragraphsOf(paper.body);
        if (index > paragraphs.length) return paper;
        paragraphs.splice(index - 1, 1);
        return { ...paper, body: bodyFrom(paragraphs) };
      }),
    summary: ({ index }) => msg(`Paragraph ${index} deleted`),
  }),

  "paper.moveParagraph": defineAction({
    description: "Move a paragraph up or down.",
    input: z.object({
      id: z.string().min(1),
      index: z.number().int().min(1),
      by: z.number().int().describe("-1 for up, 1 for down"),
    }),
    apply: (state, { id, index, by }) =>
      editLetter(state, id, (paper) => {
        const paragraphs = paragraphsOf(paper.body);
        if (index > paragraphs.length) return paper;
        return { ...paper, body: bodyFrom(shift(paragraphs, index - 1, by)) };
      }),
    summary: () => msg("Paragraphs reordered"),
  }),
} satisfies Record<string, Action>;
