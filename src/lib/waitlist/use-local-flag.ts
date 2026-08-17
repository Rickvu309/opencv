"use client";

import * as React from "react";

/**
 * A boolean kept in `localStorage`, read the way React wants it read.
 *
 * The server has no storage and the client does, which is a genuine asymmetry
 * rather than a detail to paper over. Reading in an effect and calling
 * `setState` says it the wrong way: it renders one answer, then corrects it,
 * which is a cascading render and what `react-hooks/set-state-in-effect`
 * objects to. `useSyncExternalStore` says it directly, with `false` as the
 * server's answer.
 *
 * Same shape as `lib/actions/store.tsx`, for the same reason.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab joining the waiting list should not leave this one still
  // offering to join.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Tell every reader in this tab that a flag changed. */
export function notifyLocalFlagChange() {
  for (const listener of listeners) listener();
}

export function readLocalFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeLocalFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private mode. The flag simply does not stick, which every caller here
    // treats as "ask again later" rather than as an error.
  }
  notifyLocalFlagChange();
}

export function useLocalFlag(key: string): boolean {
  // Booleans compare by value, so a fresh call per render is stable and cannot
  // loop the way a fresh object would.
  const getSnapshot = React.useCallback(() => readLocalFlag(key), [key]);
  const getServerSnapshot = React.useCallback(() => false, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
