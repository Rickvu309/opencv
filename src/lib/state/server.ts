import type { AppState } from "@/lib/actions/types";
import { currentAccount } from "@/lib/auth/dal";
import { loadAccountState } from "./account-state";

export type InitialAppState = {
  state: AppState | null;
  signedIn: boolean;
};

/**
 * The state to render the page with, and whether there is an account behind it.
 *
 * Called once, by the root layout, and handed to the store as props. Doing it
 * here rather than in the client is what makes a sign-in on a second device
 * show the same work immediately, with no request after the page arrives and
 * no moment where the profile looks empty.
 *
 * `signedIn` is separate from `state` because a failed read must not look like
 * a signed-out visitor: the store would then write the seed into localStorage
 * and, on the next successful load, could save that seed over the account.
 * Signed in with no state means "do not persist until a real row is in hand".
 *
 * The account comes from the session and nowhere else, so there is no argument
 * a caller could pass to read somebody else's row.
 */
export async function initialAppState(): Promise<InitialAppState> {
  const account = await currentAccount();
  if (!account) return { state: null, signedIn: false };

  try {
    return { state: await loadAccountState(account.id), signedIn: true };
  } catch (error) {
    console.error("state: could not load the account's state", error);
    return { state: null, signedIn: true };
  }
}
