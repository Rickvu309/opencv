// Reducer domain: first-run onboarding (flow 1). Owns Profile/Goals writes
// made once, at the end of the onboarding flow, plus the two flags that
// gate it. Split out of lib/store.tsx's single reducer (RDS-981).

import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type OnboardingAction = Extract<
  Action,
  { type: "MARK_ONBOARDED" | "RESET_ONBOARDING" | "COMPLETE_ONBOARDING" }
>;

export function reduceOnboarding(state: StoreState, action: OnboardingAction): StoreState {
  switch (action.type) {
    case "MARK_ONBOARDED":
      return { ...state, onboarded: true };

    case "RESET_ONBOARDING":
      return { ...state, onboarded: false };

    case "COMPLETE_ONBOARDING": {
      const { preferences: preferencesPatch, ...profilePatch } = action.profilePatch;
      return {
        ...state,
        profile: {
          ...state.profile,
          ...profilePatch,
          preferences: { ...state.profile.preferences, ...preferencesPatch },
        },
        goals: action.goals,
        onboarded: true,
      };
    }

    default:
      return state;
  }
}
