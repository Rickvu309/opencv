// Reducer domain: the Strategy surface's weekly focus plan (RDS-986,
// /strategy). Mirrors reducers/opportunities.ts's
// FOCUS_OPPORTUNITY_FROM_COMPARISON / UNDO_FOCUS_OPPORTUNITY_FROM_COMPARISON
// pair: Approve accepts a next action and/or sets a priority, logs one
// Activity moment naming what changed, and marks the move approved; Undo
// reverses all three cleanly by the exact ids the approve call returned.

import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type StrategyAction = Extract<
  Action,
  { type: "APPLY_STRATEGY_MOVE" | "UNDO_STRATEGY_MOVE" | "DISMISS_STRATEGY_MOVE" | "UNDISMISS_STRATEGY_MOVE" }
>;

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function reduceStrategy(state: StoreState, action: StrategyAction): StoreState {
  switch (action.type) {
    case "APPLY_STRATEGY_MOVE":
      return {
        ...state,
        opportunities:
          action.opportunityId && action.newPriority
            ? state.opportunities.map((opportunity) =>
                opportunity.id === action.opportunityId
                  ? { ...opportunity, priority: action.newPriority! }
                  : opportunity
              )
            : state.opportunities,
        nextActions: action.nextActionId
          ? state.nextActions.map((nextAction) =>
              nextAction.id === action.nextActionId ? { ...nextAction, state: "accepted" } : nextAction
            )
          : state.nextActions,
        activityMoments: action.activityMoment
          ? [...state.activityMoments, action.activityMoment]
          : state.activityMoments,
        strategyMoveStates: { ...state.strategyMoveStates, [action.moveId]: "approved" },
      };

    case "UNDO_STRATEGY_MOVE":
      return {
        ...state,
        opportunities:
          action.opportunityId && action.previousPriority
            ? state.opportunities.map((opportunity) =>
                opportunity.id === action.opportunityId
                  ? { ...opportunity, priority: action.previousPriority! }
                  : opportunity
              )
            : state.opportunities,
        nextActions: action.nextActionId
          ? state.nextActions.map((nextAction) =>
              nextAction.id === action.nextActionId ? { ...nextAction, state: "suggested" } : nextAction
            )
          : state.nextActions,
        activityMoments: action.activityMomentId
          ? state.activityMoments.filter((moment) => moment.id !== action.activityMomentId)
          : state.activityMoments,
        strategyMoveStates: withoutKey(state.strategyMoveStates, action.moveId),
      };

    case "DISMISS_STRATEGY_MOVE":
      return {
        ...state,
        strategyMoveStates: { ...state.strategyMoveStates, [action.moveId]: "dismissed" },
      };

    case "UNDISMISS_STRATEGY_MOVE":
      return {
        ...state,
        strategyMoveStates: withoutKey(state.strategyMoveStates, action.moveId),
      };

    default:
      return state;
  }
}
