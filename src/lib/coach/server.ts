import { currentAccount } from "@/lib/auth/dal";
import { readConversations } from "./account-conversations";
import type { Conversation } from "./sessions";

/**
 * The account's Coach threads for this page, or null when nobody is signed in.
 *
 * Read on the server and handed to `CoachProvider` as a prop, for the same
 * reason `lib/state/server.ts` does it for `AppState`: the thread reads its
 * list in a `useState` initialiser, where a promise cannot be awaited.
 */
export async function initialConversations(): Promise<Conversation[] | null> {
  const account = await currentAccount();
  if (!account) return null;

  try {
    return await readConversations(account.id);
  } catch (error) {
    // The database is unreachable. An empty list is the honest thing to render:
    // it is what this page can see. The alternative, falling back to whatever
    // is in this browser, would show one person another person's threads on a
    // shared device, which is worse than showing nothing.
    console.error("conversations: could not load the account's threads", error);
    return [];
  }
}
