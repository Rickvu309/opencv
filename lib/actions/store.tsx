"use client";

// The one place app state lives, and the one way it changes.
//
// Both callers funnel through `dispatch`: the UI on a click, and the Coach when
// a tool call arrives over the agent stream. Because both go through the same
// registry, an agent-driven change is indistinguishable from a user-driven one
//, which is exactly what makes the Coach able to operate the app.

import * as React from "react";
import { toast } from "sonner";

import { messages } from "@/lib/i18n/messages";
import { loadState, saveState } from "./persistence";
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
const TouchedContext = React.createContext<string[]>([]);

/**
 * The snapshot the server renders, and the one React hydrates against.
 *
 * Module scope so its identity is stable across renders. `useSyncExternalStore`
 * compares snapshots by reference and would loop forever on a fresh object.
 */
const serverSnapshot = seedState();

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  // State lives in a ref rather than `useState`, and React reads it through
  // `useSyncExternalStore`. Three things fall out of that:
  //
  //  - Hydration is honest. The server has no storage, so it renders the seed;
  //    the client reads localStorage on its first real snapshot. Handing React
  //    a separate server snapshot is the supported way to say that, instead of
  //    rendering the seed and then correcting it in an effect, which is a
  //    cascading render and what `react-hooks/set-state-in-effect` objects to.
  //  - `dispatch` can read the live value with no stale closure, and does its
  //    work outside a setState updater. React re-runs updaters in StrictMode,
  //    which would fire every toast twice.
  //  - A caller dispatching several actions in one tick (onboarding commits
  //    eight) has each build on the last, rather than all of them computing
  //    from the same starting state.
  const ref = React.useRef<AppState | null>(null);
  const listeners = React.useRef(new Set<() => void>());

  const subscribe = React.useCallback((onChange: () => void) => {
    listeners.current.add(onChange);
    return () => listeners.current.delete(onChange);
  }, []);

  // Reads storage exactly once, on the first client snapshot, then returns the
  // same reference until `dispatch` replaces it.
  const getSnapshot = React.useCallback(() => (ref.current ??= loadState()), []);
  const getServerSnapshot = React.useCallback(() => serverSnapshot, []);

  const state = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const emit = React.useCallback(() => {
    for (const listener of listeners.current) listener();
  }, []);

  // What the last change touched, so a screen showing that row can flash it.
  // Without this the user sees a toast about a change they cannot locate.
  const [touched, setTouched] = React.useState<string[]>([]);
  const clearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  /**
   * The one place a change is written down.
   *
   * This is why the registry exists: persistence is written once here, not in
   * 26 actions and never in a screen. A write that does not land warns once per
   * session rather than on every keystroke, because the app keeps working, it
   * just stops remembering, and repeating that every few seconds would be
   * noise the user cannot act on.
   */
  const warnedAboutStorage = React.useRef(false);
  const persist = React.useCallback((next: AppState) => {
    if (saveState(next) || warnedAboutStorage.current) return;
    warnedAboutStorage.current = true;
    toast.warning(messages.errors.storageFailedTitle[next.locale], {
      description: messages.errors.storageFailedBody[next.locale],
    });
  }, []);

  const dispatch = React.useCallback<Dispatch>(
    (name, input, opts) => {
      // Never null in practice: dispatch only runs from a client event, by
      // which point React has taken a snapshot. Falling back keeps the type
      // honest without pretending a branch is unreachable.
      const previous = ref.current ?? loadState();
      try {
        const next = applyAction(previous, name, input);
        ref.current = next.state;
        emit();
        persist(next.state);

        setTouched(next.touched);
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setTouched([]), 1200);

        if (!opts?.silent) {
          // Read from the state *after* the change: `settings.setLanguage`
          // confirms itself in the language it just switched to.
          const locale = next.state.locale;
          // Act, then offer the way back. The Coach edits on the user's behalf,
          // so asking permission for every change would make it useless, but a
          // change you cannot reverse is one you have to watch for.
          toast.success(next.summary[locale], {
            action: {
              label: messages.common.undo[locale],
              onClick: () => {
                ref.current = previous;
                emit();
                // Undo is a write like any other, or the reverted state comes
                // back on the next reload.
                persist(previous);
              },
            },
          });
        }
      } catch (error) {
        // A bad agent call must never break the app, surface it and move on.
        //
        // The reason this does not print `error.message`: that message comes
        // from Zod, and it is a developer's sentence. "Invalid input for
        // resume.updateEntry: [{"code":"too_small"…}]" tells a student nothing
        // they can act on. The detail belongs in the console, where whoever
        // can fix it will look.
        console.error("dispatch failed", name, error);
        const locale = previous.locale;
        toast.error(messages.errors.actionFailedTitle[locale], {
          description: messages.errors.actionFailedBody[locale],
        });
      }
    },
    [emit, persist],
  );

  return (
    <StateContext.Provider value={state}>
      <TouchedContext.Provider value={touched}>
        <DispatchContext.Provider value={dispatch}>
          {children}
        </DispatchContext.Provider>
      </TouchedContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = React.useContext(StateContext);
  if (!state) throw new Error("useAppState must be used inside AppStateProvider");
  return state;
}

/**
 * Ids changed by the most recent action, for about a second afterwards.
 * A row uses this to flash itself so the user can see *what* moved, not just
 * be told that something did. Empty most of the time.
 */
export function useTouched(): string[] {
  return React.useContext(TouchedContext);
}

export function useDispatch(): Dispatch {
  const dispatch = React.useContext(DispatchContext);
  if (!dispatch)
    throw new Error("useDispatch must be used inside AppStateProvider");
  return dispatch;
}
