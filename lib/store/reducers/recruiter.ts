// Reducer domain: recruiter mode (RDS-988, /recruiter/*). Reads and writes
// only state.recruiterRoles/state.recruiterCandidates, never touching the
// candidate-side slices every other reducer file owns, the same
// domain-per-file split RDS-981 established for the rest of the store.

import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type RecruiterAction = Extract<
  Action,
  {
    type:
      | "ADVANCE_RECRUITER_CANDIDATE_STAGE"
      | "TOGGLE_RECRUITER_CANDIDATE_FLAG"
      | "SET_RECRUITER_CANDIDATE_NOTES"
      | "APPLY_RECRUITER_DECISION"
      | "UNDO_RECRUITER_DECISION"
      | "SEND_RECRUITER_OUTREACH_DRAFT"
      | "UNDO_SEND_RECRUITER_OUTREACH_DRAFT"
      | "SET_RECRUITER_OUTREACH_DRAFT_STATE"
      | "PREPARE_RECRUITER_SUBMISSION_PACKET"
      | "SHARE_RECRUITER_SUBMISSION_PACKET";
  }
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
                // Advancing (from any path: quick actions, the identity band's
                // inline chip, or the decision block's own "advance" call)
                // resolves whatever hold or just-applied-decision confirmation
                // was showing, the same way an explicit decision would.
                hold: undefined,
                pendingDecisionUndo: undefined,
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

    case "APPLY_RECRUITER_DECISION":
      return {
        ...state,
        recruiterCandidates: state.recruiterCandidates.map((candidate) => {
          if (candidate.id !== action.id) return candidate;
          return {
            ...candidate,
            stage: action.newStage ?? candidate.stage,
            stageEnteredAt: action.newStage ? action.historyEntry.enteredAt : candidate.stageEnteredAt,
            stageHistory: [...candidate.stageHistory, action.historyEntry],
            hold: action.clearHold ? undefined : (action.hold ?? candidate.hold),
            followUpTasks: action.addedFollowUpTask
              ? [...(candidate.followUpTasks ?? []), action.addedFollowUpTask]
              : candidate.followUpTasks,
            pendingDecisionUndo: action.undo,
          };
        }),
      };

    case "UNDO_RECRUITER_DECISION":
      return {
        ...state,
        recruiterCandidates: state.recruiterCandidates.map((candidate) => {
          if (candidate.id !== action.id || !candidate.pendingDecisionUndo) return candidate;
          const undo = candidate.pendingDecisionUndo;
          return {
            ...candidate,
            stage: undo.previousStage,
            stageEnteredAt: undo.previousStageEnteredAt,
            stageHistory: candidate.stageHistory.filter((entry) => entry.id !== undo.historyEntryId),
            hold: undo.previousHold,
            followUpTasks: undo.addedFollowUpTaskId
              ? (candidate.followUpTasks ?? []).filter((task) => task.id !== undo.addedFollowUpTaskId)
              : candidate.followUpTasks,
            pendingDecisionUndo: undefined,
          };
        }),
      };

    case "SEND_RECRUITER_OUTREACH_DRAFT":
      return {
        ...state,
        recruiterOutreachDraftStates: { ...state.recruiterOutreachDraftStates, [action.draftId]: "sent" },
        recruiterCandidates: state.recruiterCandidates.map((candidate) =>
          candidate.id === action.candidateId
            ? {
                ...candidate,
                outreach: {
                  ...candidate.outreach,
                  touches: [...candidate.outreach.touches, action.touch],
                  status: action.newStatus,
                },
              }
            : candidate
        ),
      };

    case "UNDO_SEND_RECRUITER_OUTREACH_DRAFT": {
      const { [action.draftId]: _removed, ...rest } = state.recruiterOutreachDraftStates;
      return {
        ...state,
        recruiterOutreachDraftStates: rest,
        recruiterCandidates: state.recruiterCandidates.map((candidate) =>
          candidate.id === action.candidateId
            ? {
                ...candidate,
                outreach: {
                  ...candidate.outreach,
                  touches: candidate.outreach.touches.filter((touch) => touch.id !== action.touchId),
                  status: action.previousStatus,
                },
              }
            : candidate
        ),
      };
    }

    case "SET_RECRUITER_OUTREACH_DRAFT_STATE": {
      if (action.state === "proposed") {
        const { [action.draftId]: _removed, ...rest } = state.recruiterOutreachDraftStates;
        return { ...state, recruiterOutreachDraftStates: rest };
      }
      return {
        ...state,
        recruiterOutreachDraftStates: { ...state.recruiterOutreachDraftStates, [action.draftId]: action.state },
      };
    }

    case "PREPARE_RECRUITER_SUBMISSION_PACKET":
      return {
        ...state,
        recruiterCandidates: state.recruiterCandidates.map((candidate) =>
          candidate.id === action.id
            ? {
                ...candidate,
                submission: {
                  ...candidate.submission,
                  status: candidate.submission.status === "Submitted to hiring manager" ? candidate.submission.status : "Packet in progress",
                  draftSummary: action.summary,
                  packet: action.packet,
                },
              }
            : candidate
        ),
      };

    case "SHARE_RECRUITER_SUBMISSION_PACKET":
      return {
        ...state,
        recruiterCandidates: state.recruiterCandidates.map((candidate) =>
          candidate.id === action.id && candidate.submission.packet
            ? {
                ...candidate,
                stageHistory: [...candidate.stageHistory, action.historyEntry],
                submission: {
                  ...candidate.submission,
                  status: "Submitted to hiring manager",
                  packet: { ...candidate.submission.packet, sharedAt: action.sharedAt },
                },
              }
            : candidate
        ),
      };

    default:
      return state;
  }
}
