import { z } from "zod";

import { defineAction, msg, type Action } from "@/lib/actions/define";
import { nextId } from "@/lib/ids";
import { isSingletonPitchKind, pitchKinds, singletonOf } from "@/lib/pitch/types";
import type { PitchItem, PitchKind } from "@/lib/pitch/types";

export const pitchActions = {
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
        .describe("Defaults to English. Set it for an interview in Vietnamese."),
    }),
    apply: (state, { kind, body, prompt, language }) => {
      const written: PitchItem = {
        id: nextId(
          "pitch",
          state.pitch.map((p) => p.id),
        ),
        kind,
        body,
        language: language ?? "en",
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
        ? msg("Answer saved")
        : msg("Saved"),
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
    summary: () => msg("Saved"),
  }),

  "pitch.remove": defineAction({
    destructive: true,
    confirm: () =>
      msg("Delete this? It cannot be restored."),
    description:
      "Delete a saved bio, self-introduction, or interview answer the user no " +
      "longer wants.",
    input: z.object({ id: z.string().min(1) }),
    apply: (state, { id }) => ({
      ...state,
      pitch: state.pitch.filter((item) => item.id !== id),
    }),
    summary: () => msg("Deleted"),
  }),
} satisfies Record<string, Action>;
