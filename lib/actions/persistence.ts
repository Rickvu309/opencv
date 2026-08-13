import { isLocale, preferredLocale } from "@/lib/i18n/locale";
import { seedState } from "./seed";
import type { AppState } from "./types";

/**
 * Where the user's state lives between visits.
 *
 * ## Why the browser, for now
 *
 * The obvious answer is a database, and that is still the answer for more than
 * one device. It is not the answer *today*, for one reason worth writing down:
 * no server store exists yet, and the Coach does not need one. *Close the loop*
 * chose to send state to the agent on the turn (`context.ts`), so the Coach
 * already reads exactly what the UI holds, wherever that is kept. Persistence
 * and the agent's read path are therefore independent, which they would not
 * have been under read tools.
 *
 * So this closes the gap it can close honestly: a reload keeps your work. It
 * does **not** give you a second device, and it never will. That needs a store
 * both browsers can reach, and this module is the only file that has to change
 * when one exists, because every write already funnels through `dispatch`.
 *
 * ## Why the whole state, not an action log
 *
 * The registry is a pure reducer, so an append-only action log would replay
 * cleanly and give an audit trail for free. It also grows without bound until
 * snapshots exist, and needs a migration story the moment an action's schema
 * changes. With one user in one tab, last-write-wins is correct and costs
 * nothing. Revisit if the log becomes worth something on its own.
 */

/**
 * Bumped when `AppState`'s shape changes incompatibly. A stored blob from an
 * older shape is discarded rather than migrated: this is a demo account holding
 * seeded data, so the cost of dropping it is a reseed, and the cost of loading
 * it into a reducer that no longer understands it is a corrupted account.
 */
export const STORAGE_KEY = "openpath:state:v3";

/**
 * A stored blob is untrusted input: hand-edited, half-written by a killed tab,
 * or left over from a build that shaped `AppState` differently. This checks the
 * top level only. Anything deeper is the reducer's problem, and every action
 * parses its own input before touching state.
 */
function looksLikeState(value: unknown): value is AppState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<AppState>;
  return (
    isLocale(state.locale) &&
    typeof state.profile === "object" &&
    state.profile !== null &&
    Array.isArray(state.todos) &&
    typeof state.plan === "object" &&
    state.plan !== null &&
    Array.isArray(state.resumes) &&
    typeof state.paths === "object" &&
    state.paths !== null
  );
}

/**
 * The state to start from: what was stored, or the seed.
 *
 * Returns the seed on the server and on the first visit, so callers never have
 * to branch on whether storage exists.
 */
export function loadState(): AppState {
  if (typeof window === "undefined") return seedState();

  // A first visit gets the browser's language rather than ours. Nothing is
  // stored yet, so this is a guess, and the language switcher is one click away
  // in the account menu for when the guess is wrong.
  const fresh = () => seedState(preferredLocale(window.navigator?.languages));

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();

    // A blob we cannot read is worse than none, so both failures below discard
    // it. Keeping it means re-failing this on every load forever, and the user
    // has no way to clear it.
    const parsed: unknown = JSON.parse(raw);
    if (!looksLikeState(parsed)) {
      clearState();
      return fresh();
    }
    return parsed;
  } catch {
    // Malformed JSON, or storage itself refusing to answer (private mode).
    // Losing persistence is not a reason to fail to render the app.
    clearState();
    return fresh();
  }
}

/** Persist the state. Returns false if the write did not land. */
export function saveState(state: AppState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Forget everything and fall back to the seed on the next load. */
export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the caller's next write will overwrite it anyway.
  }
}
