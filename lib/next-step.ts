import type { AppState } from "@/lib/actions/types";
import { messages } from "@/lib/i18n/messages";
import type { Msg } from "@/lib/i18n/locale";

/**
 * One next step, derived from state. Every artifact screen and the Coach
 * empty greeting can ask this instead of inventing a second CTA.
 */
export type NextStep = {
  href: string;
  label: Msg;
  /** Optional Coach handoff — use as `/coach?q=`. */
  prompt?: Msg;
};

export function nextStepOf(state: AppState): NextStep {
  const { profile } = state;
  const goal = profile.identity.targetRole.trim();

  if (!goal) {
    return {
      href: "/profile",
      label: messages.nextStep.setGoal,
      prompt: messages.nextStep.setGoalPrompt,
    };
  }

  const { education, experience } = profile;
  const hasFacts =
    experience.length > 0 ||
    education.courses.length > 0 ||
    education.major.trim().length > 0;
  if (!hasFacts) {
    return {
      href: "/profile",
      label: messages.nextStep.addFacts,
      prompt: messages.nextStep.addFactsPrompt,
    };
  }

  if (state.resumes.length === 0) {
    return {
      href: "/cv",
      label: messages.nextStep.buildCv,
      prompt: messages.nextStep.buildCvPrompt,
    };
  }

  const saved = state.openings.filter((opening) => opening.saved);
  if (saved.length === 0) {
    return {
      href: "/search",
      label: messages.nextStep.findOpening,
      prompt: messages.nextStep.findOpeningPrompt,
    };
  }

  if (state.applications.length === 0) {
    return {
      href: "/applications",
      label: messages.nextStep.startApplication,
      prompt: messages.nextStep.startApplicationPrompt,
    };
  }

  return {
    href: "/applications",
    label: messages.nextStep.advanceApplication,
    prompt: messages.nextStep.advanceApplicationPrompt,
  };
}
