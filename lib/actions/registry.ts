// The action registry: every change the app can make to itself, in one place.
//
// Each entry owns three things, a description the model reads, a Zod schema
// that validates input from any caller, and a pure reducer. The UI dispatches
// these; the Coach calls the same set as tools. One definition, two callers,
// so the agent can never drift from what the app can actually do.

import { z } from "zod";

import {
  canTransition,
  type Application,
} from "@/lib/applications/types";
import { MIN_POSTING_CHARS, parseOpening } from "@/lib/search/types";

import {
  blankEntry,
  blankResume,
  emptySection,
  insertionIndex,
  nextId,
  resumeFromProfile,
} from "@/lib/cv/build";
import { sectionDefaults } from "@/lib/cv/types";
import type { Resume, ResumeSection } from "@/lib/cv/types";
import type { Msg } from "@/lib/i18n/locale";
import { bodyFrom, paperKinds, paragraphsOf } from "@/lib/papers/types";
import type { PaperKind, ProseDocument } from "@/lib/papers/types";
import { isSingletonPitchKind, pitchKinds, singletonOf } from "@/lib/pitch/types";
import type { PitchItem, PitchKind } from "@/lib/pitch/types";
import type { AppState } from "./types";

export type Action<S extends z.ZodType = z.ZodType> = {
  /** Written for the model: when to use this, in plain language. */
  description: string;
  input: S;
  apply: (state: AppState, input: z.infer<S>) => AppState;
  /**
   * One-line confirmation shown after it runs, in both languages.
   *
   * A pair rather than a string because this is the sentence the user reads in
   * a toast, and the same sentence the Coach reads back to describe what it
   * just did. Picking one language at the registry would leave the other half
   * of the product speaking the wrong one.
   */
  summary: (input: z.infer<S>) => Msg;
  /**
   * Ids of the rows this changed, so a screen showing them can flash what
   * moved. Defaults to the input's `id`, which is right for most actions;
   * override only where the reducer mints the id and the caller cannot know it.
   */
  touched?: (input: z.infer<S>, after: AppState) => string[];
  /**
   * This action destroys something the user cannot get back from the app.
   *
   * The Coach applies everything else on its own, which is the product's whole
   * promise and the reason a confirm step on every edit would be wrong. Undo
   * covers a bad edit. It does not cover a misunderstanding: "bỏ mấy việc cũ
   * đi" is a sentence a model can read as *all of them*, and by the time the
   * toast is gone so is the list.
   *
   * So the line is drawn at removal, not at "important". Additive and editing
   * actions stay automatic; these ask first, through eve's own approval gate
   * (see agent/tools/apply_action.ts).
   */
  destructive?: true;
  /**
   * The question asked before this runs. Required in spirit for every
   * `destructive` action, because eve's own prompt is "Approve tool call:
   * apply_action" — the name of an internal tool, which tells the user nothing
   * about what is about to disappear. eve exposes no hook for replacing it, so
   * the thread renders this instead.
   */
  confirm?: (input: z.infer<S>) => Msg;
};

function defineAction<S extends z.ZodType>(action: Action<S>): Action<S> {
  return action;
}

/** Shorthand so a summary stays one readable line. */
const msg = (vi: string, en: string): Msg => ({ vi, en });


const docKinds = z.enum([
  "cv",
  "portfolio",
  "cover-letter",
  "linkedin",
  "github",
]);

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
 * Rewrite one CV, leaving every other one alone, and stamp it as just-changed.
 *
 * Every `resume.*` reducer goes through here so the timestamp cannot be
 * forgotten by one of fourteen actions, which is exactly how the "cập nhật"
 * line on a card starts lying.
 */
function editResume(
  state: AppState,
  id: string,
  edit: (resume: Resume) => Resume,
): AppState {
  const target = state.resumes.find((r) => r.id === id);
  if (!target) return state;
  return {
    ...state,
    resumes: state.resumes.map((r) =>
      r.id === id ? { ...edit(r), updatedAt: "Vừa xong" } : r,
    ),
  };
}

/**
 * Rewrite one prose document, restamping it.
 *
 * The same shape as `editResume`, and separate rather than generic: the two
 * arrays hold different models, and a helper that took a key name would make
 * every call site one type assertion longer to save four lines here.
 */
function editPaper(
  state: AppState,
  id: string,
  edit: (paper: ProseDocument) => ProseDocument,
): AppState {
  const target = state.papers.find((p) => p.id === id);
  if (!target) return state;
  return {
    ...state,
    papers: state.papers.map((p) =>
      p.id === id ? { ...edit(p), updatedAt: "Vừa xong" } : p,
    ),
  };
}

/** Rewrite one section of one CV. */
function editSection(
  state: AppState,
  resumeId: string,
  sectionId: string,
  edit: (section: ResumeSection) => ResumeSection,
): AppState {
  return editResume(state, resumeId, (resume) => ({
    ...resume,
    sections: resume.sections.map((s) => (s.id === sectionId ? edit(s) : s)),
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

export const actions = {
  "document.add": defineAction({
    description:
      "Add a document version to the profile. A user keeps several per kind, " +
      "a CV for Data Analyst, another for BA, an English one, so always give " +
      "it a label and a purpose. The first document of a kind becomes primary.",
    input: z.object({
      kind: docKinds,
      label: z.string().min(1).describe('e.g. "CV, Data Analyst"'),
      purpose: z.string().optional().describe("What this version is tailored for"),
      targetRole: z.string().optional(),
      language: z.enum(["vi", "en"]).default("vi"),
      url: z.string().optional(),
      fileName: z.string().optional(),
      note: z.string().optional(),
      makePrimary: z.boolean().default(false),
    }),
    apply: (state, { makePrimary, ...doc }) => {
      const first = !state.profile.documents.some((d) => d.kind === doc.kind);
      const primary = makePrimary || first;
      const id = `${doc.kind}-${state.profile.documents.length + 1}`;
      return {
        ...state,
        profile: {
          ...state.profile,
          documents: [
            // A new primary demotes the previous one; a kind never has two.
            ...state.profile.documents.map((d) =>
              primary && d.kind === doc.kind ? { ...d, isPrimary: false } : d,
            ),
            { ...doc, id, isPrimary: primary, updatedAt: "Vừa xong" },
          ],
        },
      };
    },
    summary: ({ label }) => msg(`Đã thêm “${label}”`, `Added “${label}”`),
  }),

  "document.update": defineAction({
    description: "Edit one stored document: rename it, change its purpose, or repoint its file/link.",
    input: z.object({
      id: z.string().min(1),
      label: z.string().min(1).optional(),
      purpose: z.string().optional(),
      targetRole: z.string().optional(),
      language: z.enum(["vi", "en"]).optional(),
      url: z.string().optional(),
      fileName: z.string().optional(),
      note: z.string().optional(),
    }),
    apply: (state, { id, ...fields }) => ({
      ...state,
      profile: {
        ...state.profile,
        documents: state.profile.documents.map((d) =>
          d.id === id ? { ...d, ...fields, updatedAt: "Vừa xong" } : d,
        ),
      },
    }),
    summary: () => msg("Đã lưu tài liệu", "Document saved"),
  }),

  "document.setPrimary": defineAction({
    description:
      "Choose which version of a kind the Coach reads and shows first. " +
      "Use when the user says which CV to use for an application.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => {
      const target = state.profile.documents.find((d) => d.id === id);
      if (!target) return state;
      return {
        ...state,
        profile: {
          ...state.profile,
          documents: state.profile.documents.map((d) =>
            d.kind === target.kind ? { ...d, isPrimary: d.id === id } : d,
          ),
        },
      };
    },
    summary: () => msg("Đã đặt làm bản chính", "Set as the primary version"),
  }),

  "document.remove": defineAction({
    destructive: true,
    confirm: () => msg("Xoá tài liệu này khỏi hồ sơ?", "Remove this document from your profile?"),
    description: "Delete a stored document version.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => {
      const gone = state.profile.documents.find((d) => d.id === id);
      const rest = state.profile.documents.filter((d) => d.id !== id);
      // Deleting the primary promotes the next version of that kind, so a
      // kind is never left with documents but no primary.
      if (gone?.isPrimary) {
        const heir = rest.find((d) => d.kind === gone.kind);
        if (heir) heir.isPrimary = true;
      }
      return { ...state, profile: { ...state.profile, documents: rest } };
    },
    summary: () => msg("Đã xoá tài liệu", "Document deleted"),
  }),

  "document.sync": defineAction({
    description:
      "Re-read a link-backed document (LinkedIn, GitHub, hosted portfolio) " +
      "so the Coach sees its current contents.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      profile: {
        ...state.profile,
        documents: state.profile.documents.map((d) =>
          d.id === id ? { ...d, syncedAt: "Vừa xong" } : d,
        ),
      },
    }),
    summary: () => msg("Đã đồng bộ", "Synced"),
  }),

  "profile.setIdentity": defineAction({
    description:
      "Update the user's display name or the role they are aiming for. " +
      "Use when they tell you their goal changed.",
    input: z.object({
      name: z.string().min(1).optional(),
      targetRole: z.string().min(1).optional(),
    }),
    apply: (state, input) => ({
      ...state,
      profile: {
        ...state.profile,
        identity: { ...state.profile.identity, ...input },
      },
    }),
    summary: ({ targetRole }) =>
      targetRole
        ? msg(`Đã đổi mục tiêu sang ${targetRole}`, `Now aiming for ${targetRole}`)
        : msg("Đã cập nhật hồ sơ", "Profile updated"),
  }),

  "profile.setContext": defineAction({
    description:
      "Set one row of the user's situation (goal, time available, location, " +
      "internship window). Creates the row if the label is new.",
    input: z.object({
      label: z.string().min(1),
      value: z.string().min(1),
    }),
    apply: (state, { label, value }) => {
      const exists = state.profile.context.some((r) => r.label === label);
      return {
        ...state,
        profile: {
          ...state.profile,
          context: exists
            ? state.profile.context.map((r) =>
                r.label === label ? { label, value } : r,
              )
            : [...state.profile.context, { label, value }],
        },
      };
    },
    summary: ({ label }) => msg(`Đã cập nhật “${label}”`, `Updated “${label}”`),
  }),

  "profile.addExperience": defineAction({
    description:
      "Add a job, internship, or activity to the user's experience list.",
    input: z.object({
      title: z.string().min(1),
      org: z.string().min(1),
      period: z.string().min(1).describe("e.g. 06/2025 – 09/2025"),
      detail: z.string().default(""),
    }),
    apply: (state, input) => ({
      ...state,
      profile: {
        ...state.profile,
        experience: [...state.profile.experience, input],
      },
    }),
    summary: ({ title }) =>
      msg(`Đã thêm kinh nghiệm “${title}”`, `Added “${title}” to your experience`),
  }),

  "profile.updateExperience": defineAction({
    description:
      "Edit one existing experience entry. Index is its position in the list.",
    input: z.object({
      index: z.number().int().min(0),
      title: z.string().min(1).optional(),
      org: z.string().min(1).optional(),
      period: z.string().min(1).optional(),
      detail: z.string().optional(),
    }),
    apply: (state, { index, ...fields }) => ({
      ...state,
      profile: {
        ...state.profile,
        experience: state.profile.experience.map((e, i) =>
          i === index ? { ...e, ...fields } : e,
        ),
      },
    }),
    summary: () => msg("Đã lưu kinh nghiệm", "Experience saved"),
  }),

  "profile.removeExperience": defineAction({
    destructive: true,
    confirm: () => msg("Xoá kinh nghiệm này khỏi hồ sơ?", "Remove this experience from your profile?"),
    description: "Remove an experience entry by its position in the list.",
    input: z.object({ index: z.number().int().min(0) }),
    apply: (state, { index }) => ({
      ...state,
      profile: {
        ...state.profile,
        experience: state.profile.experience.filter((_, i) => i !== index),
      },
    }),
    summary: () => msg("Đã xoá kinh nghiệm", "Experience deleted"),
  }),

  "profile.setEducation": defineAction({
    description: "Update school, major, year of study, or GPA.",
    input: z.object({
      school: z.string().min(1).optional(),
      major: z.string().min(1).optional(),
      year: z.string().min(1).optional(),
      gpa: z.string().min(1).optional(),
    }),
    apply: (state, input) => ({
      ...state,
      profile: {
        ...state.profile,
        education: { ...state.profile.education, ...input },
      },
    }),
    summary: () => msg("Đã lưu học vấn", "Education saved"),
  }),

  "profile.addCourse": defineAction({
    description: "Add a certificate or course to the profile.",
    input: z.object({ name: z.string().min(1) }),
    apply: (state, { name }) =>
      state.profile.education.courses.includes(name)
        ? state
        : {
            ...state,
            profile: {
              ...state.profile,
              education: {
                ...state.profile.education,
                courses: [...state.profile.education.courses, name],
              },
            },
          },
    summary: ({ name }) => msg(`Đã thêm “${name}”`, `Added “${name}”`),
  }),

  "profile.removeCourse": defineAction({
    destructive: true,
    confirm: () => msg("Xoá khoá học này khỏi hồ sơ?", "Remove this course from your profile?"),
    description: "Remove a certificate or course from the profile.",
    input: z.object({ name: z.string().min(1) }),
    apply: (state, { name }) => ({
      ...state,
      profile: {
        ...state.profile,
        education: {
          ...state.profile.education,
          courses: state.profile.education.courses.filter((c) => c !== name),
        },
      },
    }),
    summary: () => msg("Đã xoá chứng chỉ", "Certificate removed"),
  }),

  "settings.setLanguage": defineAction({
    description:
      "Switch the whole app, and your own replies, between Vietnamese and " +
      "English. Use it when the user writes to you in the other language or " +
      "asks you to switch. Say the rest of your reply in the new language.",
    input: z.object({ language: z.enum(["vi", "en"]) }),
    apply: (state, { language }) => ({ ...state, locale: language }),
    // Confirmed in the language being switched *to*, in both slots: the user
    // has just asked for that language, so echoing the old one back would be
    // the first thing the setting failed to do.
    summary: ({ language }) =>
      language === "vi"
        ? msg("Đã chuyển sang tiếng Việt", "Đã chuyển sang tiếng Việt")
        : msg("Switched to English", "Switched to English"),
  }),

  // ── CV builder ──────────────────────────────────────────────────────────
  //
  // Fourteen actions rather than one `resume.set`, for the reason the rest of
  // this registry exists: the model has to be able to change one bullet without
  // resending the document, and a whole-document write is the one edit that can
  // silently delete work the user did between turns.

  "resume.create": defineAction({
    description:
      "Start a new CV for the user. With fromProfile, it arrives already " +
      "filled in from their profile, name, experience, education, " +
      "certificates, which is almost always what they want; a blank one is " +
      "for a CV unlike anything on file. Always give it a label naming the " +
      "job it is for.",
    input: z.object({
      label: z.string().min(1).describe('e.g. "CV, Data Analyst"'),
      targetRole: z.string().optional(),
      fromProfile: z.boolean().default(true),
      language: z
        .enum(["vi", "en"])
        .optional()
        .describe(
          "The CV's own language. Defaults to the app's. Set it when the " +
            "user is applying abroad and needs an English CV while reading " +
            "the app in Vietnamese.",
        ),
    }),
    apply: (state, { label, targetRole, fromProfile, language }) => {
      const id = nextId(
        "cv",
        state.resumes.map((r) => r.id),
      );
      // The document's language defaults to the one the user is reading in,
      // which is the right guess and the wrong assumption to hard-code.
      const documentLanguage = language ?? state.locale;
      const resume = fromProfile
        ? resumeFromProfile(state, id, label, documentLanguage)
        : blankResume(id, label, documentLanguage);
      if (targetRole) resume.targetRole = targetRole;
      return { ...state, resumes: [...state.resumes, resume] };
    },
    summary: ({ label }) => msg(`Đã tạo “${label}”`, `Created “${label}”`),
    touched: (_input, after) => {
      const added = after.resumes.at(-1);
      return added ? [added.id] : [];
    },
  }),

  "resume.duplicate": defineAction({
    description:
      "Copy an existing CV so the user can tailor it for another job without " +
      "losing the original. Prefer this over creating a second one from " +
      "scratch when the two share most of their content.",
    input: z.object({
      id: z.string().min(1),
      label: z.string().min(1),
    }),
    apply: (state, { id, label }) => {
      const source = state.resumes.find((r) => r.id === id);
      if (!source) return state;
      const newId = nextId(
        "cv",
        state.resumes.map((r) => r.id),
      );
      // Ids are rewritten, not copied: two sections sharing an id would make
      // every later edit land on both CVs at once.
      const copy: Resume = {
        ...source,
        id: newId,
        label,
        updatedAt: "Vừa xong",
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
      return { ...state, resumes: [...state.resumes, copy] };
    },
    summary: ({ label }) =>
      msg(`Đã nhân bản thành “${label}”`, `Duplicated as “${label}”`),
    touched: (_input, after) => {
      const added = after.resumes.at(-1);
      return added ? [added.id] : [];
    },
  }),

  "resume.remove": defineAction({
    destructive: true,
    confirm: () => msg("Xoá hẳn CV này? Không khôi phục lại được.", "Delete this CV for good? It cannot be restored."),
    description: "Delete a CV the user no longer wants.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      resumes: state.resumes.filter((r) => r.id !== id),
    }),
    summary: () => msg("Đã xoá CV", "CV deleted"),
  }),

  "resume.rename": defineAction({
    description:
      "Change what a CV is called, which job it targets, or its language.",
    input: z.object({
      id: z.string().min(1),
      label: z.string().min(1).optional(),
      targetRole: z.string().optional(),
      language: z.enum(["vi", "en"]).optional(),
    }),
    apply: (state, { id, ...fields }) =>
      editResume(state, id, (resume) => ({ ...resume, ...fields })),
    summary: () => msg("Đã lưu CV", "CV saved"),
  }),

  "resume.setHeader": defineAction({
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
      editResume(state, id, (resume) => ({
        ...resume,
        header: { ...resume.header, ...fields },
      })),
    summary: () => msg("Đã cập nhật thông tin liên hệ", "Contact details updated"),
  }),

  "resume.setPhoto": defineAction({
    description:
      "Record that this CV now has a photo, or that it no longer does. The " +
      "image itself is uploaded by the user through the CV screen and is not " +
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
      editResume(state, id, (resume) => {
        const next = { ...resume };
        if (stamp) next.photoStamp = stamp;
        else delete next.photoStamp;
        return next;
      }),
    summary: ({ stamp }) =>
      stamp ? msg("Đã thêm ảnh vào CV", "Photo added") : msg("Đã bỏ ảnh khỏi CV", "Photo removed"),
  }),

  "resume.setTheme": defineAction({
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
      editResume(state, id, (resume) => ({
        ...resume,
        theme: { ...resume.theme, ...fields },
      })),
    summary: () => msg("Đã đổi giao diện CV", "CV appearance updated"),
  }),

  "resume.addSection": defineAction({
    description:
      "Add a section to a CV. It lands where that kind belongs in the reading " +
      "order rather than at the end. Use custom for anything unnamed here, " +
      "and give it a heading.",
    input: z.object({
      id: z.string().min(1).describe("The CV's id"),
      kind: sectionKinds,
      heading: z.string().optional(),
    }),
    apply: (state, { id, kind, heading }) =>
      editResume(state, id, (resume) => {
        const section = emptySection(
          kind,
          nextId(
            `${resume.id}-s`,
            resume.sections.map((s) => s.id),
          ),
          resume.language,
          heading,
        );
        const at = insertionIndex(resume.sections, kind);
        const sections = [...resume.sections];
        sections.splice(at, 0, section);
        return { ...resume, sections };
      }),
    summary: ({ kind, heading }) =>
      msg(
        `Đã thêm mục “${heading ?? sectionDefaults[kind].heading.vi}”`,
        `Added the “${heading ?? sectionDefaults[kind].heading.en}” section`,
      ),
  }),

  "resume.updateSection": defineAction({
    description:
      "Edit a section: rename its heading, rewrite its prose (summary and " +
      "skills use body), or hide it. Hiding keeps the content but leaves it " +
      "off the printed CV, which is how a user tailors one version per job.",
    input: z.object({
      id: z.string().min(1).describe("The CV's id"),
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
    summary: () => msg("Đã lưu mục trong CV", "Section saved"),
    touched: ({ sectionId }) => [sectionId],
  }),

  "resume.removeSection": defineAction({
    destructive: true,
    confirm: () => msg("Xoá mục này khỏi CV? Ẩn đi thì giữ được nội dung.", "Delete this CV section? Hiding it keeps the content."),
    description:
      "Delete a section and everything in it. Prefer hiding it if the user " +
      "may want it back for another application.",
    input: z.object({
      id: z.string().min(1),
      sectionId: z.string().min(1),
    }),
    apply: (state, { id, sectionId }) =>
      editResume(state, id, (resume) => ({
        ...resume,
        sections: resume.sections.filter((s) => s.id !== sectionId),
      })),
    summary: () => msg("Đã xoá mục khỏi CV", "Section deleted"),
  }),

  "resume.moveSection": defineAction({
    description:
      "Move a section up or down. Order matters: a reader spends longest on " +
      "whatever is first, so the strongest section belongs near the top.",
    input: z.object({
      id: z.string().min(1),
      sectionId: z.string().min(1),
      by: z.number().int().describe("-1 for up, 1 for down"),
    }),
    apply: (state, { id, sectionId, by }) =>
      editResume(state, id, (resume) => {
        const index = resume.sections.findIndex((s) => s.id === sectionId);
        if (index === -1) return resume;
        return { ...resume, sections: shift(resume.sections, index, by) };
      }),
    summary: () => msg("Đã đổi thứ tự mục", "Sections reordered"),
    touched: ({ sectionId }) => [sectionId],
  }),

  "resume.addEntry": defineAction({
    description:
      "Add one job, degree, project or certificate to a section. Put each " +
      "result on its own line in detail; they become bullets. Write what " +
      "changed because of the user, with a number where there is one, not a " +
      "list of duties.",
    input: z.object({
      id: z.string().min(1).describe("The CV's id"),
      sectionId: z.string().min(1),
      // Not `.min(1)`: the editor adds a blank entry and lets the user type
      // into it, which is the only sane order for a form. An untitled entry is
      // simply skipped by the preview and by every export.
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
        ? msg(`Đã thêm “${title}” vào CV`, `Added “${title}” to your CV`)
        : msg("Đã thêm một mục vào CV", "Added an entry to your CV"),
    touched: ({ sectionId }, after) => {
      const section = after.resumes
        .flatMap((r) => r.sections)
        .find((s) => s.id === sectionId);
      const added = section?.entries.at(-1);
      return added ? [added.id] : [];
    },
  }),

  "resume.updateEntry": defineAction({
    description:
      "Rewrite one entry in a CV. This is the action to use when sharpening a " +
      "bullet: send only the fields that change.",
    input: z.object({
      id: z.string().min(1).describe("The CV's id"),
      sectionId: z.string().min(1),
      entryId: z.string().min(1),
      /** Clearable, for the same reason `resume.addEntry` allows it. */
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
    summary: () => msg("Đã sửa một mục trong CV", "Entry updated"),
    touched: ({ entryId }) => [entryId],
  }),

  "resume.removeEntry": defineAction({
    destructive: true,
    confirm: () => msg("Xoá dòng này khỏi CV?", "Delete this entry from the CV?"),
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
    summary: () => msg("Đã xoá một mục khỏi CV", "Entry deleted"),
  }),

  "resume.moveEntry": defineAction({
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
    summary: () => msg("Đã đổi thứ tự trong CV", "Entries reordered"),
    touched: ({ entryId }) => [entryId],
  }),

  /* ── Prose documents: cover letters and project write-ups ─────────────── */
  // The résumé actions above edit sections and dated entries. These edit
  // paragraphs, which is what a letter is made of. Same pattern, different
  // structure; see `lib/papers/types.ts` for why one model could not be both.

  "paper.create": defineAction({
    description:
      "Start a cover letter or a project write-up. Give it a label naming " +
      "what it is for. Pass `body` to write the first draft in the same " +
      "step, with a blank line between paragraphs; leave it out to create an " +
      "empty one for the user to fill in.",
    input: z.object({
      kind: z.enum(paperKinds as [PaperKind, ...PaperKind[]]),
      label: z.string().min(1).describe('e.g. "Thư cho VNG"'),
      targetRole: z.string().optional(),
      body: z.string().optional(),
      language: z
        .enum(["vi", "en"])
        .optional()
        .describe(
          "The document's own language. Defaults to the app's. Set it when " +
            "the user is applying abroad and needs an English letter while " +
            "reading the app in Vietnamese.",
        ),
    }),
    apply: (state, { kind, label, targetRole, body, language }) => {
      const paper: ProseDocument = {
        id: nextId(
          "paper",
          state.papers.map((p) => p.id),
        ),
        kind,
        label,
        // The document's language defaults to the one the user is reading in,
        // which is the right guess and the wrong assumption to hard-code.
        language: language ?? state.locale,
        body: body ?? "",
        updatedAt: "Vừa xong",
      };
      if (targetRole) paper.targetRole = targetRole;
      return { ...state, papers: [...state.papers, paper] };
    },
    summary: ({ label }) => msg(`Đã tạo “${label}”`, `Created “${label}”`),
    touched: (_input, after) => {
      const added = after.papers.at(-1);
      return added ? [added.id] : [];
    },
  }),

  "paper.rename": defineAction({
    description:
      "Change what a letter or write-up is called, which role it targets, or " +
      "its language.",
    input: z.object({
      id: z.string().min(1),
      label: z.string().min(1).optional(),
      targetRole: z.string().optional(),
      language: z.enum(["vi", "en"]).optional(),
    }),
    apply: (state, { id, ...fields }) =>
      editPaper(state, id, (paper) => ({ ...paper, ...fields })),
    summary: () => msg("Đã lưu", "Saved"),
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
    apply: (state, { id, body }) => editPaper(state, id, (paper) => ({ ...paper, body })),
    summary: () => msg("Đã viết lại", "Rewritten"),
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
      editPaper(state, id, (paper) => {
        const paragraphs = paragraphsOf(paper.body);
        // Out of range changes nothing rather than appending. A model that
        // miscounted should not silently add a paragraph nobody asked for.
        if (index > paragraphs.length) return paper;
        paragraphs[index - 1] = text;
        return { ...paper, body: bodyFrom(paragraphs) };
      }),
    summary: ({ index }) =>
      msg(`Đã sửa đoạn ${index}`, `Paragraph ${index} rewritten`),
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
      editPaper(state, id, (paper) => {
        const paragraphs = paragraphsOf(paper.body);
        const position = at === undefined ? paragraphs.length : Math.min(at - 1, paragraphs.length);
        paragraphs.splice(position, 0, text);
        return { ...paper, body: bodyFrom(paragraphs) };
      }),
    summary: () => msg("Đã thêm một đoạn", "Paragraph added"),
  }),

  "paper.removeParagraph": defineAction({
    // Every `.remove*` action asks first, without exception. A paragraph is
    // sentences the user wrote, and undo lives in a toast that leaves.
    destructive: true,
    confirm: ({ index }) =>
      msg(`Xoá đoạn ${index}?`, `Delete paragraph ${index}?`),
    description: "Delete one paragraph, counting from 1.",
    input: z.object({
      id: z.string().min(1),
      index: z.number().int().min(1),
    }),
    apply: (state, { id, index }) =>
      editPaper(state, id, (paper) => {
        const paragraphs = paragraphsOf(paper.body);
        if (index > paragraphs.length) return paper;
        paragraphs.splice(index - 1, 1);
        return { ...paper, body: bodyFrom(paragraphs) };
      }),
    summary: ({ index }) => msg(`Đã xoá đoạn ${index}`, `Paragraph ${index} deleted`),
  }),

  "paper.moveParagraph": defineAction({
    description: "Move a paragraph up or down.",
    input: z.object({
      id: z.string().min(1),
      index: z.number().int().min(1),
      by: z.number().int().describe("-1 for up, 1 for down"),
    }),
    apply: (state, { id, index, by }) =>
      editPaper(state, id, (paper) => {
        const paragraphs = paragraphsOf(paper.body);
        if (index > paragraphs.length) return paper;
        return { ...paper, body: bodyFrom(shift(paragraphs, index - 1, by)) };
      }),
    summary: () => msg("Đã đổi thứ tự các đoạn", "Paragraphs reordered"),
  }),

  "paper.remove": defineAction({
    destructive: true,
    confirm: ({ id }) => {
      void id;
      return msg(
        "Xoá hẳn văn bản này? Không khôi phục lại được.",
        "Delete this document for good? It cannot be restored.",
      );
    },
    description: "Delete a letter or write-up the user no longer wants.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      papers: state.papers.filter((p) => p.id !== id),
    }),
    summary: () => msg("Đã xoá văn bản", "Document deleted"),
  }),

  /* ── Pitch: the bio, the self-introduction, the answer bank ───────────── */

  "pitch.write": defineAction({
    description:
      "Save the user's online bio, their self-introduction, or an answer to " +
      "an interview question. A bio and a self-introduction are one each, so " +
      "writing one replaces what was there; an answer is added to the bank, " +
      "and needs the question it answers as `prompt`. Never invent an example " +
      "the profile does not contain; ask the user instead.",
    input: z.object({
      kind: z.enum(pitchKinds as [PitchKind, ...PitchKind[]]),
      // Empty is allowed, because the answer bank's "add a question" starts a
      // row the user then types into, and seeding it with a placeholder
      // character would leave that character in their saved answer. The Coach
      // always sends text; nothing stops it, and nothing needs to.
      body: z.string(),
      prompt: z
        .string()
        .optional()
        .describe('The interview question, e.g. "Điểm yếu của bạn là gì?"'),
      language: z
        .enum(["vi", "en"])
        .optional()
        .describe("Defaults to the app's. Set it for an interview in the other one."),
    }),
    apply: (state, { kind, body, prompt, language }) => {
      const written: PitchItem = {
        id: nextId(
          "pitch",
          state.pitch.map((p) => p.id),
        ),
        kind,
        body,
        language: language ?? state.locale,
      };
      if (prompt) written.prompt = prompt;

      // A person has one bio and one answer to "tell me about yourself".
      // Enforced here rather than on the screen, so the Coach cannot make a
      // second one by asking for it.
      if (isSingletonPitchKind(kind)) {
        const existing = singletonOf(state.pitch, kind);
        if (existing) {
          return {
            ...state,
            pitch: state.pitch.map((item) =>
              item.id === existing.id ? { ...written, id: existing.id } : item,
            ),
          };
        }
      }
      return { ...state, pitch: [...state.pitch, written] };
    },
    summary: ({ kind }) =>
      kind === "answer"
        ? msg("Đã lưu câu trả lời", "Answer saved")
        : msg("Đã lưu phần giới thiệu", "Saved"),
    touched: ({ kind }, after) => {
      const item = isSingletonPitchKind(kind)
        ? singletonOf(after.pitch, kind)
        : after.pitch.at(-1);
      return item ? [item.id] : [];
    },
  }),

  "pitch.update": defineAction({
    description:
      "Change a saved bio, self-introduction, or answer: its text, the " +
      "question it answers, or its language. Use this to sharpen wording " +
      "rather than writing a new one, so the user keeps their undo.",
    input: z.object({
      id: z.string().min(1),
      body: z.string().min(1).optional(),
      prompt: z.string().optional(),
      language: z.enum(["vi", "en"]).optional(),
    }),
    apply: (state, { id, ...fields }) => ({
      ...state,
      pitch: state.pitch.map((item) =>
        item.id === id ? { ...item, ...fields } : item,
      ),
    }),
    summary: () => msg("Đã lưu", "Saved"),
  }),

  "pitch.remove": defineAction({
    destructive: true,
    confirm: () =>
      msg(
        "Xoá phần này? Không khôi phục lại được.",
        "Delete this? It cannot be restored.",
      ),
    description:
      "Delete a saved bio, self-introduction, or interview answer the user no " +
      "longer wants.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      pitch: state.pitch.filter((item) => item.id !== id),
    }),
    summary: () => msg("Đã xoá", "Deleted"),
  }),

  /* ── My Search: real postings ─────────────────────────────────────────── */

  "opening.add": defineAction({
    description:
      "Add a job opening from a posting the user pasted, a link or the text " +
      "of the advert. Use when the user shows you a job they are considering.",
    input: z.object({
      text: z
        .string()
        .min(MIN_POSTING_CHARS)
        .describe("The pasted posting, or a link to it"),
    }),
    apply: (state, { text }) => {
      const opening = parseOpening(text);
      if (!opening) return state;
      return { ...state, openings: [opening, ...state.openings] };
    },
    summary: () => msg("Đã thêm tin tuyển dụng", "Added the opening"),
    touched: (_input, after) => [after.openings[0]?.id].filter(Boolean) as string[],
  }),

  "opening.save": defineAction({
    description:
      "Save an opening the user is interested in, so it can become an " +
      "application. Use when they say they want to apply, or to keep it.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      openings: state.openings.map((opening) =>
        opening.id === id ? { ...opening, saved: true } : opening,
      ),
    }),
    summary: () => msg("Đã lưu tin này", "Saved"),
  }),

  "opening.unsave": defineAction({
    description: "Take an opening off the saved list. Not a deletion.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      openings: state.openings.map((opening) =>
        opening.id === id ? { ...opening, saved: false } : opening,
      ),
    }),
    summary: () => msg("Đã bỏ lưu", "Removed from saved"),
  }),

  "opening.remove": defineAction({
    destructive: true,
    confirm: () =>
      msg("Xoá tin tuyển dụng này?", "Delete this opening?"),
    description:
      "Delete an opening entirely. Prefer `opening.unsave` when the user " +
      "only wants it off their shortlist.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      openings: state.openings.filter((opening) => opening.id !== id),
      // An application whose opening is gone is a row that can no longer say
      // what it is an application to, so it goes with it.
      applications: state.applications.filter((app) => app.openingId !== id),
    }),
    summary: () => msg("Đã xoá tin tuyển dụng", "Opening deleted"),
  }),

  /* ── My Applications ──────────────────────────────────────────────────── */

  "application.create": defineAction({
    description:
      "Start tracking an application to a saved opening. Use when the user " +
      "says they are applying, or has applied, to a job they saved.",
    input: z.object({
      openingId: z.string().min(1),
      status: z
        .enum(["interested", "applied", "interviewing", "offer", "rejected"])
        .default("interested"),
    }),
    apply: (state, { openingId, status }) => {
      // Saving is what makes an opening applicable, and an application to
      // something that is not on the list would show as a blank row.
      const opening = state.openings.find((entry) => entry.id === openingId);
      if (!opening) return state;
      // One application per opening. Two rows for one job is a tracker that
      // disagrees with itself about where that job stands.
      if (state.applications.some((app) => app.openingId === openingId)) {
        return state;
      }
      const now = Date.now();
      const application: Application = {
        id: nextId("app", state.applications.map((app) => app.id)),
        openingId,
        status,
        tailoredDocumentIds: [],
        notes: "",
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...state,
        // Saved by the same act: you cannot be applying to something you have
        // not kept.
        openings: state.openings.map((entry) =>
          entry.id === openingId ? { ...entry, saved: true } : entry,
        ),
        applications: [application, ...state.applications],
      };
    },
    summary: () => msg("Đã thêm vào danh sách ứng tuyển", "Added to your applications"),
    touched: (_input, after) => [after.applications[0]?.id].filter(Boolean) as string[],
  }),

  "application.setStatus": defineAction({
    description:
      "Move an application to another stage: interested, applied, " +
      "interviewing, offer, or rejected. Only when the user says it moved.",
    input: z.object({
      id: z.string().min(1),
      status: z.enum([
        "interested",
        "applied",
        "interviewing",
        "offer",
        "rejected",
      ]),
    }),
    apply: (state, { id, status }) => ({
      ...state,
      applications: state.applications.map((app) =>
        // An impossible move is ignored rather than thrown: the transitions
        // are a product rule, and a rejected dispatch would surface to the
        // user as "that change didn't go through" for a change that was never
        // meaningful.
        app.id === id && canTransition(app.status, status)
          ? { ...app, status, updatedAt: Date.now() }
          : app,
      ),
    }),
    summary: () => msg("Đã cập nhật trạng thái", "Status updated"),
  }),

  "application.setNotes": defineAction({
    description:
      "Save the user's notes on an application: who they spoke to, what was " +
      "asked, what to prepare.",
    input: z.object({ id: z.string().min(1), notes: z.string() }),
    apply: (state, { id, notes }) => ({
      ...state,
      applications: state.applications.map((app) =>
        app.id === id ? { ...app, notes, updatedAt: Date.now() } : app,
      ),
    }),
    summary: () => msg("Đã lưu ghi chú", "Notes saved"),
  }),

  "application.setDeadline": defineAction({
    description:
      "Set or clear the deadline on an application. Date only, as YYYY-MM-DD.",
    input: z.object({
      id: z.string().min(1),
      // Empty clears it. A deadline is a day, not an instant, so no time zone
      // is involved and none should be invented.
      deadline: z
        .string()
        .regex(/^(\d{4}-\d{2}-\d{2})?$/, "use YYYY-MM-DD, or empty to clear"),
    }),
    apply: (state, { id, deadline }) => ({
      ...state,
      applications: state.applications.map((app) =>
        app.id === id
          ? { ...app, deadline: deadline || undefined, updatedAt: Date.now() }
          : app,
      ),
    }),
    summary: () => msg("Đã đặt hạn nộp", "Deadline set"),
  }),

  "application.remove": defineAction({
    destructive: true,
    confirm: () =>
      msg(
        "Xoá đơn ứng tuyển này? Ghi chú sẽ mất theo.",
        "Delete this application? Its notes go too.",
      ),
    description: "Stop tracking an application.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      applications: state.applications.filter((app) => app.id !== id),
    }),
    summary: () => msg("Đã xoá đơn ứng tuyển", "Application deleted"),
  }),

  /* ── Tailoring, per application ───────────────────────────────────────── */

  "application.tailorResume": defineAction({
    description:
      "Make a copy of one of the user's CVs for a specific application, so it " +
      "can be cut down for that job without touching the original. Use before " +
      "tailoring anything, then edit the copy.",
    input: z.object({
      id: z.string().min(1).describe("Application id"),
      resumeId: z.string().min(1).describe("The CV to copy"),
      label: z.string().min(1),
    }),
    apply: (state, { id, resumeId, label }) => {
      const application = state.applications.find((app) => app.id === id);
      const source = state.resumes.find((resume) => resume.id === resumeId);
      if (!application || !source) return state;

      // The copy is made by the same duplicate the CV screen uses, so a
      // tailored CV is an ordinary CV in every respect except what it is bound
      // to. Nothing here reimplements the copying, which is what keeps ids
      // rewritten and sections independent.
      const copied = applyAction(state, "resume.duplicate", {
        id: resumeId,
        label,
      }).state;
      const created = copied.resumes.find(
        (resume) => !state.resumes.some((before) => before.id === resume.id),
      );
      if (!created) return state;

      return {
        ...copied,
        applications: copied.applications.map((app) =>
          app.id === id
            ? {
                ...app,
                tailoredDocumentIds: [...app.tailoredDocumentIds, created.id],
                updatedAt: Date.now(),
              }
            : app,
        ),
      };
    },
    summary: ({ label }) =>
      msg(`Đã tạo “${label}” cho vị trí này`, `Created “${label}” for this job`),
  }),

  "application.tailorLetter": defineAction({
    description:
      "Start a cover letter bound to a specific application. Pass `body` to " +
      "write the first draft in the same step.",
    input: z.object({
      id: z.string().min(1).describe("Application id"),
      label: z.string().min(1),
      targetRole: z.string().optional(),
      body: z.string().optional(),
    }),
    apply: (state, { id, label, targetRole, body }) => {
      const application = state.applications.find((app) => app.id === id);
      if (!application) return state;

      const created = applyAction(state, "paper.create", {
        kind: "cover-letter",
        label,
        targetRole,
        body,
      }).state;
      const paper = created.papers.find(
        (entry) => !state.papers.some((before) => before.id === entry.id),
      );
      if (!paper) return state;

      return {
        ...created,
        applications: created.applications.map((app) =>
          app.id === id
            ? {
                ...app,
                tailoredDocumentIds: [...app.tailoredDocumentIds, paper.id],
                updatedAt: Date.now(),
              }
            : app,
        ),
      };
    },
    summary: ({ label }) =>
      msg(`Đã tạo “${label}”`, `Created “${label}”`),
  }),
} satisfies Record<string, Action>;

export type ActionName = keyof typeof actions;

export const actionNames = Object.keys(actions) as ActionName[];

/**
 * Erase the per-action generic at the dynamic-dispatch boundary. Indexing the
 * map by a runtime string makes TypeScript intersect every action's input type,
 * which nothing can satisfy. Safe because we parse before applying.
 */
type OpaqueAction = {
  description: string;
  input: z.ZodType;
  apply: (state: AppState, input: never) => AppState;
  summary: (input: never) => Msg;
  touched?: (input: never, after: AppState) => string[];
  destructive?: true;
  confirm?: (input: never) => Msg;
};

export function lookupAction(name: string): OpaqueAction | undefined {
  return (actions as Record<string, OpaqueAction>)[name];
}

/**
 * Narrow a string that arrived from outside the app, an agent tool result or a
 * stored action log, to a name the registry actually knows.
 */
export function isActionName(name: string): name is ActionName {
  return Object.hasOwn(actions, name);
}

/**
 * Does this action destroy something, and therefore need asking about first?
 *
 * Unknown names answer false: an action the registry does not have cannot be
 * run either, and `apply_action` rejects it a moment later with a message the
 * model can act on. Answering true here would turn a typo into a confirmation
 * dialogue for a change that was never going to happen.
 */
export function isDestructiveAction(name: string): boolean {
  return lookupAction(name)?.destructive === true;
}

/** The removals, for tests and for anything that needs to reason about them. */
export const destructiveActionNames = actionNames.filter(isDestructiveAction);

/** Validate and run an action. Throws on unknown name or bad input. */
export function applyAction(
  state: AppState,
  name: string,
  rawInput: unknown,
): { state: AppState; summary: Msg; touched: string[] } {
  const action = lookupAction(name);
  if (!action) {
    throw new Error(
      `Unknown action "${name}". Available: ${actionNames.join(", ")}`,
    );
  }
  const input = action.input.parse(rawInput) as never;
  const after = action.apply(state, input);
  const id = (input as { id?: unknown }).id;
  return {
    state: after,
    summary: action.summary(input),
    touched: action.touched
      ? action.touched(input, after)
      : typeof id === "string"
        ? [id]
        : [],
  };
}
