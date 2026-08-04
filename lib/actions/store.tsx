"use client";

// The one place app state lives, and the one way it changes.
//
// Both callers funnel through `dispatch`: the UI on a click, and the Coach when
// a tool call arrives over the agent stream. Because both go through the same
// registry, an agent-driven change is indistinguishable from a user-driven one
// — which is exactly what makes the Coach able to operate the app.

import * as React from "react";
import { toast } from "sonner";

import { applyAction, type ActionName } from "./registry";
import { seedState } from "./seed";
import type { AppState } from "./types";

type Dispatch = <N extends ActionName>(
  name: N,
  input: unknown,
  opts?: { silent?: boolean },
) => void;

const StateContext = React.createContext<AppState | null>(null);
const DispatchContext = React.createContext<Dispatch | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState>(seedState);

  const dispatch = React.useCallback<Dispatch>((name, input, opts) => {
    setState((current) => {
      try {
        const next = applyAction(current, name, input);
        if (!opts?.silent) toast.success(next.summary);
        return next.state;
      } catch (error) {
        // A bad agent call must never break the app — surface it and move on.
        toast.error("Không thực hiện được thay đổi", {
          description: error instanceof Error ? error.message : String(error),
        });
        return current;
      }
    });
  }, []);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = React.useContext(StateContext);
  if (!state) throw new Error("useAppState must be used inside AppStateProvider");
  return state;
}

export function useDispatch(): Dispatch {
  const dispatch = React.useContext(DispatchContext);
  if (!dispatch)
    throw new Error("useDispatch must be used inside AppStateProvider");
  return dispatch;
}
