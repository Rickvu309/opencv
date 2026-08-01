// Reducer domain: recruiter mode (RDS-988, /recruiter/*). Reads and writes
// only state.recruiterRoles/state.recruiterCandidates, never touching the
// candidate-side slices every other reducer file owns, the same
// domain-per-file split RDS-981 established for the rest of the store.

import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type RecruiterAction = Extract<
  Action,
  { type: "ADVANCE_RECRUITER_CANDIDATE_STAGE" | "TOGGLE_RECRUITER_CANDIDATE_FLAG" | "SET_RECRUITER_CANDIDATE_NOTES" }
>;

export function reduceRecruiter(state: StoreState, action: RecruiterAction): StoreState {
  switch (action.type) {
    case "ADVANCE_RECRUITER_CANDIDATE_STAGE":
      return {
        ...state,
        recruiterCandidates: state.recruiterCandidates.map((candidate) =>
          candidate.id === action.id
            ? {
                ...candidate,
                stage: action.stage,
                stageEnteredAt: action.historyEntry.enteredAt,
                stageHistory: [...candidate.stageHistory, action.historyEntry],
              }
            : candidate
        ),
      };

    case "TOGGLE_RECRUITER_CANDIDATE_FLAG":
      return {
        ...state,
        recruiterCandidates: state.recruiterCandidates.map((candidate) =>
          candidate.id === action.id ? { ...candidate, flaggedForReview: !candidate.flaggedForReview } : candidate
        ),
      };

    case "SET_RECRUITER_CANDIDATE_NOTES":
      return {
        ...state,
        recruiterCandidates: state.recruiterCandidates.map((candidate) =>
          candidate.id === action.id ? { ...candidate, notes: action.notes } : candidate
        ),
      };

    default:
      return state;
  }
}
