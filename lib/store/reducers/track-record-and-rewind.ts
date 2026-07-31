// Reducer domain: TrackRecordEntry objects (flow 7, /track-record) and
// Rewind (flow 9's connected weekly review, /rewind), which writes into the
// same TrackRecordEntry shape rather than a forked type (see docs/lessons.md
// item 26) and can pin a Nudge into Home's attention queue. Split out of
// lib/store.tsx's single reducer (RDS-981).

import { pinnedNudgeId } from "@/lib/nudge-utils";
import { buildPinnedNudgeFromCarryForward } from "@/lib/rewind-utils";
import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type TrackRecordAndRewindAction = Extract<
  Action,
  {
    type:
      | "CONFIRM_TRACK_RECORD_CANDIDATE"
      | "REMOVE_TRACK_RECORD_ENTRY"
      | "ADD_TRACK_RECORD_ENTRY"
      | "SET_TRACK_RECORD_HIGHLIGHT"
      | "CLEAR_TRACK_RECORD_HIGHLIGHT"
      | "SET_REWIND_CARRY_FORWARD_STATE"
      | "SAVE_REWIND_CANDIDATE"
      | "SET_REWIND_CANDIDATE_STATE"
      | "MARK_REWIND_VIEWED";
  }
>;

export function reduceTrackRecordAndRewind(state: StoreState, action: TrackRecordAndRewindAction): StoreState {
  switch (action.type) {
    case "CONFIRM_TRACK_RECORD_CANDIDATE":
      return {
        ...state,
        trackRecordEntries: state.trackRecordEntries.map((entry) =>
          entry.id === action.id
            ? { ...entry, ...action.patch, status: "confirmed" }
            : entry
        ),
      };

    case "REMOVE_TRACK_RECORD_ENTRY":
      return {
        ...state,
        trackRecordEntries: state.trackRecordEntries.filter((entry) => entry.id !== action.id),
      };

    case "ADD_TRACK_RECORD_ENTRY":
      return {
        ...state,
        trackRecordEntries: [action.entry, ...state.trackRecordEntries],
      };

    case "SET_TRACK_RECORD_HIGHLIGHT":
      return { ...state, highlightedTrackRecordEntryId: action.id };

    case "CLEAR_TRACK_RECORD_HIGHLIGHT":
      return state.highlightedTrackRecordEntryId === action.id
        ? { ...state, highlightedTrackRecordEntryId: undefined }
        : state;

    case "SET_REWIND_CARRY_FORWARD_STATE": {
      const carryForward = state.rewindCarryForwards.find((entry) => entry.id === action.id);
      const nudgeId = pinnedNudgeId(action.id);

      // Accepting a carry-forward pins a matching Nudge into the Home
      // attention queue (guarded by id, so accepting twice never duplicates
      // it) and, where it names one, adds its planned next action to that
      // opportunity's plan (also guarded by id). Toggling back off removes
      // the pinned card again; the planned next action, once added, stays.
      let nudges = state.nudges;
      let nextActions = state.nextActions;

      if (carryForward && action.state === "accepted" && !state.nudges.some((nudge) => nudge.id === nudgeId)) {
        nudges = [...nudges, buildPinnedNudgeFromCarryForward(carryForward)];

        if (carryForward.relatedOpportunityId && carryForward.plannedNextAction) {
          const plannedId = `action-rewind-${carryForward.id}`;
          if (!nextActions.some((entry) => entry.id === plannedId)) {
            nextActions = [
              ...nextActions,
              {
                id: plannedId,
                opportunityId: carryForward.relatedOpportunityId,
                verb: carryForward.plannedNextAction.verb,
                rationale: carryForward.plannedNextAction.rationale,
                effort: carryForward.plannedNextAction.effort,
                dueHint: carryForward.plannedNextAction.dueHint,
                state: "suggested",
                confidence: "Medium",
              },
            ];
          }
        }
      } else if (action.state !== "accepted") {
        nudges = state.nudges.filter((nudge) => nudge.id !== nudgeId);
      }

      return {
        ...state,
        nudges,
        nextActions,
        rewindCarryForwards: state.rewindCarryForwards.map((entry) =>
          entry.id === action.id ? { ...entry, state: action.state } : entry
        ),
      };
    }

    case "SAVE_REWIND_CANDIDATE": {
      const exists = state.trackRecordEntries.some((entry) => entry.id === action.entry.id);
      return {
        ...state,
        trackRecordEntries: exists
          ? state.trackRecordEntries.map((entry) => (entry.id === action.entry.id ? action.entry : entry))
          : [action.entry, ...state.trackRecordEntries],
        rewindCandidates: state.rewindCandidates.map((candidate) =>
          candidate.id === action.candidateId ? { ...candidate, state: "saved" } : candidate
        ),
      };
    }

    case "SET_REWIND_CANDIDATE_STATE":
      return {
        ...state,
        rewindCandidates: state.rewindCandidates.map((candidate) =>
          candidate.id === action.id ? { ...candidate, state: action.state } : candidate
        ),
      };

    case "MARK_REWIND_VIEWED":
      return { ...state, rewindViewedThisSession: true };

    default:
      return state;
  }
}
