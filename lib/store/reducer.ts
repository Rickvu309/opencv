// The store's single root reducer: routes each action to its domain
// reducer under lib/store/reducers/. The switch below only dispatches by
// action type, it holds no state-transition logic itself, that all lives in
// the domain files. Splitting the previously 1000+ line switch statement in
// lib/store.tsx into these domains was RDS-981's hygiene pass; behavior is
// unchanged, this file is pure code motion.

import { reduceOnboarding } from "@/lib/store/reducers/onboarding";
import { reduceOpportunities } from "@/lib/store/reducers/opportunities";
import { reduceAiSignalsAndSources } from "@/lib/store/reducers/ai-signals-and-sources";
import { reduceCvs } from "@/lib/store/reducers/cvs";
import { reduceDirection } from "@/lib/store/reducers/direction";
import { reduceTrackRecordAndRewind } from "@/lib/store/reducers/track-record-and-rewind";
import { reduceProfile } from "@/lib/store/reducers/profile";
import { reduceShell } from "@/lib/store/reducers/shell";
import { reduceStrategy } from "@/lib/store/reducers/strategy";
import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

export function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case "MARK_ONBOARDED":
    case "RESET_ONBOARDING":
    case "COMPLETE_ONBOARDING":
      return reduceOnboarding(state, action);

    case "SET_OPPORTUNITY_STATUS":
    case "SET_OPPORTUNITY_PRIORITY":
    case "TOGGLE_OPPORTUNITY_DREAM":
    case "SET_OPPORTUNITY_NOTES":
    case "SET_OPPORTUNITIES_VIEW":
    case "ADD_OPPORTUNITY":
    case "CLEAR_OPPORTUNITY_HIGHLIGHT":
    case "SET_COMPARISON_MODE":
    case "SET_COMPARISON_SELECTION":
    case "TOGGLE_COMPARISON_SELECTION":
    case "FOCUS_OPPORTUNITY_FROM_COMPARISON":
    case "UNDO_FOCUS_OPPORTUNITY_FROM_COMPARISON":
    case "SET_NEXT_ACTION_STATE":
    case "EDIT_NEXT_ACTION":
    case "ACCEPT_ALTERNATIVE":
    case "REMOVE_NEXT_ACTION":
      return reduceOpportunities(state, action);

    case "APPROVE_AI_SIGNAL":
    case "UNDO_AI_SIGNAL":
    case "DISMISS_AI_SIGNAL":
    case "UNDISMISS_AI_SIGNAL":
    case "CONNECT_SOURCE":
    case "LINK_INBOX_ITEM":
    case "UNDO_LINK_INBOX_ITEM":
    case "DISMISS_INBOX_ITEM":
    case "UNDO_DISMISS_INBOX_ITEM":
      return reduceAiSignalsAndSources(state, action);

    case "SET_TAILORING_SUGGESTION_STATE":
    case "ADD_CV_VERSION":
    case "DELETE_CV_VERSION":
    case "SET_CV_SECTION_CONTENT":
    case "SET_CV_OPPORTUNITY_LINK":
    case "CREATE_TAILORED_CV_VERSION":
      return reduceCvs(state, action);

    case "ADD_GOAL":
    case "EDIT_GOAL":
    case "SET_GOAL_STATUS":
    case "ADD_GOAL_PROGRESS_NOTE":
    case "SET_GOAL_HIGHLIGHT":
    case "CLEAR_GOAL_HIGHLIGHT":
    case "UPDATE_TARGET_DIRECTION":
    case "SET_LEARNING_ITEM_STATE":
    case "SET_WORKING_PATH_SCENARIO":
    case "SET_PLAN_ITEM_STATE":
    case "ADD_ROADMAP_RESOURCE_TO_PLAN":
    case "SET_ROADMAP_RESOURCE_STATE":
    case "TOGGLE_SKILL_FOCUS":
    case "SET_SKILL_HIGHLIGHT":
    case "CLEAR_SKILL_HIGHLIGHT":
      return reduceDirection(state, action);

    case "CONFIRM_TRACK_RECORD_CANDIDATE":
    case "REMOVE_TRACK_RECORD_ENTRY":
    case "ADD_TRACK_RECORD_ENTRY":
    case "SET_TRACK_RECORD_HIGHLIGHT":
    case "CLEAR_TRACK_RECORD_HIGHLIGHT":
    case "SET_REWIND_CARRY_FORWARD_STATE":
    case "SAVE_REWIND_CANDIDATE":
    case "SET_REWIND_CANDIDATE_STATE":
    case "MARK_REWIND_VIEWED":
      return reduceTrackRecordAndRewind(state, action);

    case "APPLY_STRATEGY_MOVE":
    case "UNDO_STRATEGY_MOVE":
    case "DISMISS_STRATEGY_MOVE":
    case "UNDISMISS_STRATEGY_MOVE":
      return reduceStrategy(state, action);

    case "SET_PROFILE_SUMMARY":
    case "SET_PROFILE_EXPERIENCE_ENTRY":
    case "ADD_PROFILE_EXPERIENCE_ENTRY":
    case "SET_PROFILE_STRENGTHS":
    case "SET_PROFILE_PREFERENCES":
      return reduceProfile(state, action);

    case "SET_NUDGE_STATE":
    case "SET_COPILOT_OPEN":
    case "TOGGLE_COPILOT":
    case "SET_SIDEBAR_OPEN":
    case "SET_COPILOT_SURFACE":
    case "ADD_COPILOT_MESSAGE":
    case "SET_COPILOT_THINKING":
      return reduceShell(state, action);

    default:
      return state;
  }
}
