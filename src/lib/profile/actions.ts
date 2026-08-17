import { z } from "zod";

import { defineAction, msg, type Action } from "@/lib/actions/define";

const docKinds = z.enum(["portfolio", "linkedin", "github"]);

export const profileActions = {
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
      language: z.enum(["vi", "en"]).default("en"),
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
            { ...doc, id, isPrimary: primary, updatedAt: "Just now" },
          ],
        },
      };
    },
    summary: ({ label }) => msg(`Added “${label}”`),
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
          d.id === id ? { ...d, ...fields, updatedAt: "Just now" } : d,
        ),
      },
    }),
    summary: () => msg("Document saved"),
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
    summary: () => msg("Set as the primary version"),
  }),

  "document.remove": defineAction({
    destructive: true,
    confirm: () => msg("Remove this document from your profile?"),
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
    summary: () => msg("Document deleted"),
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
          d.id === id ? { ...d, syncedAt: "Just now" } : d,
        ),
      },
    }),
    summary: () => msg("Synced"),
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
        ? msg(`Now aiming for ${targetRole}`)
        : msg("Profile updated"),
    touched: () => ["identity"],
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
    summary: ({ label }) => msg(`Updated “${label}”`),
    touched: () => ["context"],
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
      msg(`Added “${title}” to your experience`),
    touched: () => ["experience"],
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
    summary: () => msg("Experience saved"),
    touched: () => ["experience"],
  }),

  "profile.removeExperience": defineAction({
    destructive: true,
    confirm: () => msg("Remove this experience from your profile?"),
    description: "Remove an experience entry by its position in the list.",
    input: z.object({ index: z.number().int().min(0) }),
    apply: (state, { index }) => ({
      ...state,
      profile: {
        ...state.profile,
        experience: state.profile.experience.filter((_, i) => i !== index),
      },
    }),
    summary: () => msg("Experience deleted"),
    touched: () => ["experience"],
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
    summary: () => msg("Education saved"),
    touched: () => ["education"],
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
    summary: ({ name }) => msg(`Added “${name}”`),
    touched: () => ["education"],
  }),

  "profile.removeCourse": defineAction({
    destructive: true,
    confirm: () => msg("Remove this course from your profile?"),
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
    summary: () => msg("Certificate removed"),
    touched: () => ["education"],
  }),
} satisfies Record<string, Action>;
