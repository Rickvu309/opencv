// Shared shape of one registry entry. Artefact modules define tables of these;
// lib/actions/registry.ts spreads them into the one write seam.

import { z } from "zod";

import type { Msg } from "@/lib/i18n/locale";
import type { AppState } from "./types";

export type Action<S extends z.ZodType = z.ZodType> = {
  /** Written for the model: when to use this, in plain language. */
  description: string;
  input: S;
  apply: (state: AppState, input: z.infer<S>) => AppState;
  /**
   * One-line confirmation shown after it runs.
   *
   * The sentence the user reads in a toast, and the same sentence the Coach
   * reads back to describe what it just did.
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

export function defineAction<S extends z.ZodType>(action: Action<S>): Action<S> {
  return action;
}

/** Shorthand so a summary stays one readable line. */
export const msg = (en: string): Msg => en;
