// Reducer domain: cross-cutting app-shell state that isn't owned by any one
// object type: Home's Nudge queue and the Copilot panel / sidebar UI state.
// Split out of lib/store.tsx's single reducer (RDS-981).

import type { StoreState } from "@/lib/store/state";
import type { Action } from "@/lib/store/actions";

type ShellAction = Extract<
  Action,
  {
    type:
      | "SET_NUDGE_STATE"
      | "SET_COPILOT_OPEN"
      | "TOGGLE_COPILOT"
      | "SET_SIDEBAR_OPEN"
      | "SET_COPILOT_SURFACE"
      | "ADD_COPILOT_MESSAGE"
      | "SET_COPILOT_THINKING";
  }
>;

export function reduceShell(state: StoreState, action: ShellAction): StoreState {
  switch (action.type) {
    case "SET_NUDGE_STATE":
      return {
        ...state,
        nudges: state.nudges.map((nudge) =>
          nudge.id === action.id ? { ...nudge, state: action.state } : nudge
        ),
      };

    case "SET_COPILOT_OPEN":
      return { ...state, copilot: { ...state.copilot, open: action.open } };

    case "TOGGLE_COPILOT":
      return { ...state, copilot: { ...state.copilot, open: !state.copilot.open } };

    case "SET_SIDEBAR_OPEN":
      return { ...state, sidebarOpen: action.open };

    case "SET_COPILOT_SURFACE":
      return {
        ...state,
        copilot: { ...state.copilot, surface: action.surface, objectLabel: action.objectLabel },
      };

    case "ADD_COPILOT_MESSAGE": {
      const existing = state.copilot.messagesBySurface[action.surface] ?? [];
      return {
        ...state,
        copilot: {
          ...state.copilot,
          messagesBySurface: {
            ...state.copilot.messagesBySurface,
            [action.surface]: [...existing, action.message],
          },
        },
      };
    }

    case "SET_COPILOT_THINKING":
      return { ...state, copilot: { ...state.copilot, thinking: action.thinking } };

    default:
      return state;
  }
}
