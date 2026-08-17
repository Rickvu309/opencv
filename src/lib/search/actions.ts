import { z } from "zod";

import { defineAction, msg, type Action } from "@/lib/actions/define";
import { MIN_POSTING_CHARS, parseOpening } from "@/lib/search/types";

export const searchActions = {
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
    summary: () => msg("Added the opening"),
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
    summary: () => msg("Saved"),
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
    summary: () => msg("Removed from saved"),
  }),

  "opening.remove": defineAction({
    destructive: true,
    confirm: () =>
      msg("Delete this opening?"),
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
    summary: () => msg("Opening deleted"),
  }),
} satisfies Record<string, Action>;
