import type { Msg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

/**
 * The auth endpoints' stable codes, turned into something a person can act on.
 *
 * The server answers `{ ok: false, code: "username-taken" }` and never a
 * sentence, because it cannot know which language this browser reads. This is
 * the other end of that decision, and it lives on the client where the catalog
 * and the reader's chosen locale both are. `lib/waitlist` does the same thing
 * for the same reason.
 */

/** Which field an error belongs beside, so it is shown where it happened. */
export type ProblemField = "username" | "password" | "form";

export type Problem = { field: ProblemField; message: Msg };

export function authProblem(code: string | undefined): Problem {
  switch (code) {
    case "username-required":
      return { field: "username", message: messages.errors.authUsernameRequired };
    case "username-taken":
      return { field: "username", message: messages.errors.authUsernameTaken };
    case "username-too-long":
      return { field: "username", message: messages.errors.authUsernameTooLong };
    case "password-required":
      return { field: "password", message: messages.errors.authPasswordRequired };
    case "password-too-short":
      return { field: "password", message: messages.errors.authPasswordTooShort };
    // Not beside either field, on purpose: putting it under the password would
    // say the username was fine, which is the disclosure AC-ACCT-002.2 forbids.
    case "bad-credentials":
      return { field: "form", message: messages.errors.authBadCredentials };
    case "rate-limited":
      return { field: "form", message: messages.errors.authRateLimited };
    case "offline":
      return { field: "form", message: messages.errors.authOffline };
    default:
      // Anything unrecognised is the server having a bad day, including the
      // codes this client has not been taught yet. "Try again shortly" is true
      // of all of them.
      return { field: "form", message: messages.errors.authStoreDown };
  }
}
