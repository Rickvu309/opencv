// The action registry: every change the app can make to itself, in one place.
//
// Each artefact owns its table. This file is the catalog the UI and the Coach
// both dispatch through, so the agent can never drift from what the app can
// actually do.

import { z } from "zod";

import { applicationActions } from "@/lib/applications/actions";
import { paperActions } from "@/lib/paper/actions";
import { pitchActions } from "@/lib/pitch/actions";
import { profileActions } from "@/lib/profile/actions";
import { searchActions } from "@/lib/search/actions";
import type { Msg } from "@/lib/i18n/locale";
import type { Action } from "./define";
import type { AppState } from "./types";

export type { Action } from "./define";

export const actions = {
  ...profileActions,
  ...paperActions,
  ...pitchActions,
  ...searchActions,
  ...applicationActions,
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
