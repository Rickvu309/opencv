import type { AppState } from "@/lib/actions/types";
import { currentAccount } from "@/lib/auth/dal";
import { loadAccountState } from "./account-state";

/**
 * The state to render the page with, or null when nobody is signed in.
 *
 * Called once, by the root layout, and handed to the store as a prop. Doing it
 * here rather than in the client is what makes a sign-in on a second device
 * show the same work immediately, with no request after the page arrives and
 * no moment where the profile looks empty.
 *
 * The account comes from the session and nowhere else, so there is no argument
 * a caller could pass to read somebody else's row.
 */
export async function initialAppState(): Promise<AppState | null> {
  const account = await currentAccount();
  if (!account) return null;

  try {
    return await loadAccountState(account.id);
  } catch (error) {
    // The database is unreachable. Rendering the app with an empty state and
    // then letting it save over the real row would destroy the user's work, so
    // this returns null: the store falls back to the anonymous path, which
    // writes to the browser and never to the account.
    console.error("state: could not load the account's state", error);
    return null;
  }
}
