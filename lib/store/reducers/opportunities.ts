// Reducer domain: Opportunity objects (flows 2, 3, 4) and their NextAction
// objects (flow 5), which are scoped to an opportunity closely enough to
// stay in the same file. Split out of lib/store.tsx's single reducer
// (RDS-981).

import { PANEL_PREP_TRIGGER_ACTION_ID, PANEL_PREP_CANDIDATE_ID, buildPanelPrepCandidate } from "@/lib/data/track-record";
import { MAX_COMPARISON } from "@/lib/comparison-utils";
import { makeId, today } from "@/lib/store/helpers";
import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";
import type { ActivityMoment, NextAction } from "@/lib/types";

type OpportunitiesAction = Extract<
  Action,
  {
    type:
      | "SET_OPPORTUNITY_STATUS"
      | "SET_OPPORTUNITY_PRIORITY"
      | "TOGGLE_OPPORTUNITY_DREAM"
      | "SET_OPPORTUNITY_NOTES"
      | "SET_OPPORTUNITIES_VIEW"
      | "SET_OPPORTUNITIES_MODE"
      | "SET_OPPORTUNITIES_FILTER"
      | "SET_OPPORTUNITIES_SORT"
      | "SET_OPPORTUNITIES_STATUS_FILTER"
      | "SET_OPPORTUNITIES_CLOSED_EXPANDED"
      | "MOVE_OPPORTUNITY_TO_ACTIVE"
      | "MOVE_OPPORTUNITY_TO_WATCHLIST"
      | "ADD_OPPORTUNITY"
      | "CLEAR_OPPORTUNITY_HIGHLIGHT"
      | "SET_COMPARISON_MODE"
      | "SET_COMPARISON_SELECTION"
      | "TOGGLE_COMPARISON_SELECTION"
      | "FOCUS_OPPORTUNITY_FROM_COMPARISON"
      | "UNDO_FOCUS_OPPORTUNITY_FROM_COMPARISON"
      | "SET_NEXT_ACTION_STATE"
      | "EDIT_NEXT_ACTION"
      | "ACCEPT_ALTERNATIVE"
      | "REMOVE_NEXT_ACTION";
  }
>;

export function reduceOpportunities(state: StoreState, action: OpportunitiesAction): StoreState {
  switch (action.type) {
    case "SET_OPPORTUNITY_STATUS": {
      const dateStamp = today();
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id
            ? { ...opportunity, status: action.status, lastActivityAt: dateStamp }
            : opportunity
        ),
        activityMoments: [
          ...state.activityMoments,
          {
            id: makeId("activity"),
            opportunityId: action.id,
            kind: "status-change",
            message: `Status changed to ${action.status}.`,
            createdAt: dateStamp,
          },
        ],
      };
    }

    case "SET_OPPORTUNITY_PRIORITY":
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id
            ? { ...opportunity, priority: action.priority }
            : opportunity
        ),
      };

    case "TOGGLE_OPPORTUNITY_DREAM":
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id
            ? { ...opportunity, isDream: !opportunity.isDream }
            : opportunity
        ),
      };

    case "SET_OPPORTUNITY_NOTES": {
      const dateStamp = today();
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id
            ? { ...opportunity, notes: action.notes, lastActivityAt: dateStamp }
            : opportunity
        ),
        activityMoments: [
          ...state.activityMoments,
          {
            id: makeId("activity"),
            opportunityId: action.id,
            kind: "note-added",
            message: "Added a note to this opportunity.",
            createdAt: dateStamp,
          },
        ],
      };
    }

    case "SET_OPPORTUNITIES_VIEW":
      return { ...state, opportunitiesView: action.view };

    case "SET_OPPORTUNITIES_MODE":
      return { ...state, opportunitiesMode: action.mode };

    case "SET_OPPORTUNITIES_FILTER":
      return { ...state, opportunitiesFilter: action.filter };

    case "SET_OPPORTUNITIES_SORT":
      return { ...state, opportunitiesSort: action.sort };

    case "SET_OPPORTUNITIES_STATUS_FILTER":
      return { ...state, opportunitiesStatusFilter: action.status };

    case "SET_OPPORTUNITIES_CLOSED_EXPANDED":
      return { ...state, opportunitiesClosedExpanded: action.expanded };

    // The Watchlist card/row's own confirmed move: accepts the opportunity's
    // suggested next action (the "being worked" bar isActiveOpportunity
    // checks), which is what actually pulls it into the Active lens, no
    // separate flag to keep in sync. A no-op if there's nothing suggested to
    // accept, the dialog that dispatches this only offers the action once a
    // suggested next action exists.
    case "MOVE_OPPORTUNITY_TO_ACTIVE": {
      const dateStamp = today();
      const suggested = state.nextActions.find(
        (nextAction) => nextAction.opportunityId === action.id && nextAction.state === "suggested"
      );
      if (!suggested) return state;

      return {
        ...state,
        nextActions: state.nextActions.map((nextAction) =>
          nextAction.id === suggested.id ? { ...nextAction, state: "accepted" } : nextAction
        ),
        activityMoments: [
          ...state.activityMoments,
          {
            id: makeId("activity"),
            opportunityId: action.id,
            kind: "action-accepted",
            message: `Moved to Active: accepted the next action, ${suggested.verb}.`,
            createdAt: dateStamp,
          },
        ],
      };
    }

    // The reverse move, offered from the quick-actions menu on a Saved
    // opportunity that's currently in the Active lens: un-accepts its
    // accepted next action back to suggested, the same "being worked" bar
    // in reverse, so it drops back into Watchlist without touching status.
    case "MOVE_OPPORTUNITY_TO_WATCHLIST": {
      const dateStamp = today();
      const accepted = state.nextActions.find(
        (nextAction) => nextAction.opportunityId === action.id && nextAction.state === "accepted"
      );
      if (!accepted) return state;

      return {
        ...state,
        nextActions: state.nextActions.map((nextAction) =>
          nextAction.id === accepted.id ? { ...nextAction, state: "suggested" } : nextAction
        ),
        activityMoments: [
          ...state.activityMoments,
          {
            id: makeId("activity"),
            opportunityId: action.id,
            kind: "status-change",
            message: `Moved to Watchlist: ${accepted.verb} is queued again, not yet accepted.`,
            createdAt: dateStamp,
          },
        ],
      };
    }

    case "ADD_OPPORTUNITY":
      return {
        ...state,
        opportunities: [action.opportunity, ...state.opportunities],
        insights: action.insights ? [...state.insights, ...action.insights] : state.insights,
        nextActions: action.nextAction
          ? [...state.nextActions, action.nextAction]
          : state.nextActions,
        activityMoments: action.activityMoments
          ? [...state.activityMoments, ...action.activityMoments]
          : state.activityMoments,
        highlightedOpportunityId: action.opportunity.id,
      };

    case "CLEAR_OPPORTUNITY_HIGHLIGHT":
      return state.highlightedOpportunityId === action.id
        ? { ...state, highlightedOpportunityId: undefined }
        : state;

    case "SET_COMPARISON_MODE":
      return { ...state, comparisonModeActive: action.active };

    case "SET_COMPARISON_SELECTION":
      return { ...state, comparisonSelection: action.ids };

    case "TOGGLE_COMPARISON_SELECTION": {
      const alreadySelected = state.comparisonSelection.includes(action.id);
      if (alreadySelected) {
        return {
          ...state,
          comparisonSelection: state.comparisonSelection.filter((id) => id !== action.id),
        };
      }
      if (state.comparisonSelection.length >= MAX_COMPARISON) return state;
      return { ...state, comparisonSelection: [...state.comparisonSelection, action.id] };
    }

    case "FOCUS_OPPORTUNITY_FROM_COMPARISON":
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id ? { ...opportunity, priority: "High" } : opportunity
        ),
        nextActions: action.pinNextActionId
          ? state.nextActions.map((nextAction) =>
              nextAction.id === action.pinNextActionId ? { ...nextAction, state: "accepted" } : nextAction
            )
          : state.nextActions,
        activityMoments: [...state.activityMoments, action.activityMoment],
      };

    case "UNDO_FOCUS_OPPORTUNITY_FROM_COMPARISON":
      return {
        ...state,
        opportunities: state.opportunities.map((opportunity) =>
          opportunity.id === action.id ? { ...opportunity, priority: action.previousPriority } : opportunity
        ),
        nextActions: action.nextActionId
          ? state.nextActions.map((nextAction) =>
              nextAction.id === action.nextActionId
                ? { ...nextAction, state: action.previousNextActionState ?? nextAction.state }
                : nextAction
            )
          : state.nextActions,
        activityMoments: state.activityMoments.filter((moment) => moment.id !== action.activityMomentId),
      };

    case "SET_NEXT_ACTION_STATE": {
      const target = state.nextActions.find((nextAction) => nextAction.id === action.id);
      const becameAccepted = action.state === "accepted" && target?.state !== "accepted";
      const becameDone = action.state === "done" && target?.state !== "done";
      const dateStamp = today();

      const updatedActions = state.nextActions.map((nextAction) =>
        nextAction.id === action.id ? { ...nextAction, state: action.state } : nextAction
      );

      const followUpAction: NextAction | null =
        becameDone && target?.followUp
          ? {
              id: makeId("action"),
              opportunityId: target.opportunityId,
              verb: target.followUp.verb,
              rationale: target.followUp.rationale,
              effort: target.followUp.effort,
              dueHint: target.followUp.dueHint,
              state: "suggested",
              confidence: target.followUp.confidence,
            }
          : null;

      const newActivityMoments: ActivityMoment[] = [];
      if (becameAccepted && target) {
        newActivityMoments.push({
          id: makeId("activity"),
          opportunityId: target.opportunityId,
          kind: "action-accepted",
          message: `Accepted the next action: ${target.verb}`,
          createdAt: dateStamp,
        });
      }
      if (becameDone && target) {
        newActivityMoments.push({
          id: makeId("activity"),
          opportunityId: target.opportunityId,
          kind: "action-done",
          message: `Marked done: ${target.verb}`,
          createdAt: dateStamp,
        });
      }
      if (followUpAction) {
        newActivityMoments.push({
          id: makeId("activity"),
          opportunityId: followUpAction.opportunityId,
          kind: "copilot-analysis",
          message: `Copilot suggested a follow-up: ${followUpAction.verb}`,
          createdAt: dateStamp,
        });
      }

      // The one scripted example of flow 9's capture prompt: marking done
      // the Meridian Labs panel-prep action while that opportunity sits at
      // Interview seeds a fresh Track Record candidate into the review
      // inbox. Guarded by opportunity status (not just the action id) and
      // by checking the candidate isn't already seeded, so replaying the
      // done transition never duplicates it.
      const targetOpportunity = target
        ? state.opportunities.find((opportunity) => opportunity.id === target.opportunityId)
        : undefined;
      const shouldSeedCandidate =
        becameDone &&
        action.id === PANEL_PREP_TRIGGER_ACTION_ID &&
        targetOpportunity?.status === "Interview" &&
        !state.trackRecordEntries.some((entry) => entry.id === PANEL_PREP_CANDIDATE_ID);
      const seededCandidate = shouldSeedCandidate ? buildPanelPrepCandidate(dateStamp) : null;

      return {
        ...state,
        nextActions: followUpAction ? [...updatedActions, followUpAction] : updatedActions,
        activityMoments:
          newActivityMoments.length > 0
            ? [...state.activityMoments, ...newActivityMoments]
            : state.activityMoments,
        trackRecordEntries: seededCandidate
          ? [...state.trackRecordEntries, seededCandidate]
          : state.trackRecordEntries,
      };
    }

    case "EDIT_NEXT_ACTION":
      return {
        ...state,
        nextActions: state.nextActions.map((nextAction) =>
          nextAction.id === action.id ? { ...nextAction, ...action.patch } : nextAction
        ),
      };

    case "ACCEPT_ALTERNATIVE": {
      const target = state.nextActions.find((nextAction) => nextAction.id === action.id);
      const alternative = target?.alternatives?.find((entry) => entry.id === action.alternativeId);
      if (!target || !alternative) return state;
      const dateStamp = today();

      return {
        ...state,
        nextActions: state.nextActions.map((nextAction) =>
          nextAction.id === action.id
            ? {
                ...nextAction,
                verb: alternative.verb,
                rationale: alternative.rationale,
                effort: alternative.effort,
                dueHint: alternative.dueHint,
                confidence: alternative.confidence,
                state: "accepted",
                followUp: alternative.followUp,
                handoff: alternative.handoff,
                copilotPrompt: alternative.copilotPrompt,
                alternatives: nextAction.alternatives?.filter(
                  (entry) => entry.id !== action.alternativeId
                ),
              }
            : nextAction
        ),
        activityMoments: [
          ...state.activityMoments,
          {
            id: makeId("activity"),
            opportunityId: target.opportunityId,
            kind: "action-accepted",
            message: `Accepted the next action: ${alternative.verb}`,
            createdAt: dateStamp,
          },
        ],
      };
    }

    case "REMOVE_NEXT_ACTION":
      return {
        ...state,
        nextActions: state.nextActions.filter((nextAction) => nextAction.id !== action.id),
      };

    default:
      return state;
  }
}
