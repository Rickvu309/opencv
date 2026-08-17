import { z } from "zod";

import { defineAction, msg, type Action } from "@/lib/actions/define";

export const onboardingActions = {
  "onboarding.complete": defineAction({
    description:
      "Mark first-run setup as finished. Only the onboarding screen uses this. " +
      "Do not call it; a returning user is already past that screen.",
    input: z.object({}),
    apply: (state) => {
      if (state.onboardingCompletedAt) return state;
      return { ...state, onboardingCompletedAt: new Date().toISOString() };
    },
    summary: () => msg("Onboarding finished"),
  }),
} satisfies Record<string, Action>;
