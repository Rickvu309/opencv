import { withAuthChallenges, type AuthFn } from "eve/channels/auth";
import type { ClientBase } from "pg";

import { readSessionCookie, readToken } from "./cookie";
import { readSession } from "./sessions";

/**
 * The agent's door, opened by the signed-in user rather than a shared password.
 *
 * ## Why this lives in `lib/auth/` and not beside the channel
 *
 * eve loads every file under `agent/channels/` as a channel and validates its
 * default export against the channel shape. This is a helper, not a channel, so
 * sitting there killed the agent process on boot: `eve dev` refused the file and
 * exited before printing a server URL, which takes the Coach down with it.
 * Moving it one directory up only traded that for a warning on every boot,
 * because `channels/`, `tools/` and `skills/` are the only directories eve
 * knows about. So it belongs here, with the session code it is made of;
 * `agent/channels/eve.ts` imports it.
 *
 * ## What this replaces
 *
 * There was one demo account here, its password printed on the sign-in form,
 * guarding the agent with HTTP Basic. That was honest about what it protected:
 * not user data, which did not exist per-user, but the model tokens an open
 * endpoint would burn. Now that accounts exist, the same door can ask a better
 * question, and the answer identifies who is asking.
 *
 * ## Why the turn is authorized at all
 *
 * The Coach costs money per turn and acts on the user's behalf. Both reasons
 * survive the migration: the first is why the endpoint is not open, and the
 * second is new, because the principal on the turn is now a real account.
 *
 * ## Fails closed, quietly
 *
 * Anything unresolvable returns null, which skips to the next entry in the walk
 * and ends in a 401 if nothing else accepts. That includes a missing
 * `SESSION_SECRET` and an unreachable database: an agent that opened itself
 * because it could not check would be worse than one that is briefly shut.
 */
export function userSession(
  // The same optional-connection shape every function in `lib/auth` takes, so
  // this one can be pointed at a throwaway schema by a test rather than at the
  // account table the product is using.
  db?: Pick<ClientBase, "query">,
): AuthFn<Request> {
  let warned = false;

  return withAuthChallenges(async (request: Request) => {
    const cookie = readSessionCookie(request.headers.get("cookie"));
    if (!cookie) return null;

    try {
      const token = readToken(cookie);
      if (!token) return null;

      const account = await readSession(token, db);
      if (!account) return null;

      return {
        authenticator: "openpath-session",
        principalType: "user",
        principalId: account.id,
        subject: account.username,
        attributes: { username: account.username },
      };
    } catch (error) {
      // A misconfigured deployment shuts the agent, and says so once rather
      // than on every request, because the fix is an environment variable and
      // the log needs to be readable while somebody looks for it.
      if (!warned) {
        warned = true;
        console.error("agent: the session could not be checked", error);
      }
      return null;
    }
  }, [{ scheme: "Bearer" }]);
}
