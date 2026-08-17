import { z } from "zod";

import { defineAction, msg, type Action } from "@/lib/actions/define";
import {
  canTransition,
  type Application,
} from "@/lib/applications/types";
import { nextId } from "@/lib/ids";
import { isCvPaper } from "@/lib/paper";
import { paperActions } from "@/lib/paper/actions";

export const applicationActions = {
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
    summary: () => msg("Added to your applications"),
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
    summary: () => msg("Status updated"),
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
    summary: () => msg("Notes saved"),
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
    summary: () => msg("Deadline set"),
  }),

  "application.remove": defineAction({
    destructive: true,
    confirm: () =>
      msg("Delete this application? Its notes go too."),
    description: "Stop tracking an application.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      applications: state.applications.filter((app) => app.id !== id),
    }),
    summary: () => msg("Application deleted"),
  }),

  /* ── Tailoring, per application ───────────────────────────────────────── */

  "application.tailorCv": defineAction({
    description:
      "Make a copy of one of the user's CVs for a specific application, so it " +
      "can be cut down for that job without touching the original. Use before " +
      "tailoring anything, then edit the copy.",
    input: z.object({
      id: z.string().min(1).describe("Application id"),
      paperId: z.string().min(1).describe("The CV-type paper to copy"),
      label: z.string().min(1),
    }),
    apply: (state, { id, paperId, label }) => {
      const application = state.applications.find((app) => app.id === id);
      const source = state.paper.find((p) => p.id === paperId);
      if (!application || !source || !isCvPaper(source)) return state;

      const copied = paperActions["paper.duplicate"].apply(state, {
        id: paperId,
        label,
      });
      const created = copied.paper.find(
        (p) => !state.paper.some((before) => before.id === p.id),
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
      msg(`Created “${label}” for this job`),
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

      const created = paperActions["paper.create"].apply(state, {
        type: "letter",
        label,
        targetRole,
        fromProfile: true,
        body,
      });
      const paper = created.paper.find(
        (entry) => !state.paper.some((before) => before.id === entry.id),
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
      msg(`Created “${label}”`),
  }),
} satisfies Record<string, Action>;
