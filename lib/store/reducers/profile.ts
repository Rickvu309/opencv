// Reducer domain: the Profile object's user-editable fields (/profile).
// Target direction lives in reducers/direction.ts instead, since it's read
// by Goals and the Path Planner as much as by Profile itself. Split out of
// lib/store.tsx's single reducer (RDS-981).

import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type ProfileAction = Extract<
  Action,
  {
    type:
      | "SET_PROFILE_SUMMARY"
      | "SET_PROFILE_EXPERIENCE_ENTRY"
      | "ADD_PROFILE_EXPERIENCE_ENTRY"
      | "SET_PROFILE_STRENGTHS"
      | "SET_PROFILE_PREFERENCES";
  }
>;

export function reduceProfile(state: StoreState, action: ProfileAction): StoreState {
  switch (action.type) {
    case "SET_PROFILE_SUMMARY":
      return { ...state, profile: { ...state.profile, summary: action.summary } };

    case "SET_PROFILE_EXPERIENCE_ENTRY":
      return {
        ...state,
        profile: {
          ...state.profile,
          experience: state.profile.experience.map((entry) =>
            entry.id === action.id ? { ...entry, ...action.patch } : entry
          ),
        },
      };

    case "ADD_PROFILE_EXPERIENCE_ENTRY":
      return {
        ...state,
        profile: { ...state.profile, experience: [action.entry, ...state.profile.experience] },
      };

    case "SET_PROFILE_STRENGTHS":
      return { ...state, profile: { ...state.profile, strengths: action.strengths } };

    case "SET_PROFILE_PREFERENCES":
      return {
        ...state,
        profile: {
          ...state.profile,
          preferences: { ...state.profile.preferences, ...action.patch },
        },
      };

    default:
      return state;
  }
}
