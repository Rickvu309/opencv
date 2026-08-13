/**
 * The four things that turn a new account into a used one.
 *
 * ## Why it reads state rather than remembering ticks
 *
 * A checklist with its own stored ticks drifts: somebody deletes the CV they
 * made and the list still says they made one. Every step here is a question
 * asked of the real store, so the list cannot disagree with the product. It
 * also means a user who did these before ever seeing the list arrives with them
 * already done, which is the correct behaviour and not a special case.
 */

import type { AppState } from "@/lib/actions/types";
import { messages } from "@/lib/i18n/messages";
import type { Msg } from "@/lib/i18n/locale";

export type ChecklistStep = {
  id: "goal" | "facts" | "document" | "coach";
  label: Msg;
  done: boolean;
  href: string;
};

export function checklistSteps(
  state: AppState,
  /** Whether this account has ever had a Coach conversation. */
  hasTalkedToCoach: boolean,
): ChecklistStep[] {
  const c = messages.onboarding;
  const { profile } = state;

  return [
    {
      id: "goal",
      label: c.stepGoal,
      done: profile.identity.targetRole.trim().length > 0,
      href: "/profile",
    },
    {
      id: "facts",
      // One course or one experience. Deliberately low: the point is to get
      // past an empty profile, not to finish it.
      label: c.stepFacts,
      done:
        profile.education.courses.length > 0 || profile.experience.length > 0,
      href: "/profile",
    },
    {
      id: "document",
      // Anything produced here counts. A CV, a letter, a line of pitch: the
      // step is "you have made something with this", not "you have made a CV".
      label: c.stepDocument,
      done:
        state.resumes.length > 0 ||
        state.papers.length > 0 ||
        state.pitch.length > 0,
      href: "/cv",
    },
    {
      id: "coach",
      label: c.stepCoach,
      done: hasTalkedToCoach,
      href: "/coach",
    },
  ];
}

/** Nothing left to do. The list takes itself away at this point. */
export function checklistComplete(steps: readonly ChecklistStep[]): boolean {
  return steps.every((step) => step.done);
}
