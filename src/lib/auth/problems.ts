import type { Msg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

/**
 * The auth endpoints' stable codes, turned into something a person can act on.
 *
 * The server answers `{ ok: false, code: "email-taken" }` and never a
 * sentence, because it cannot know which language this browser reads. This is
 * the other end of that decision, and it lives on the client where the catalog
 * and the reader's chosen locale both are. `lib/waitlist` does the same thing
 * for the same reason.
 */

/** Which field an error belongs beside, so it is shown where it happened. */
export type ProblemField = "email" | "password" | "confirm" | "form";

export type Problem = { field: ProblemField; message: Msg };

export function authProblem(code: string | undefined): Problem {
  switch (code) {
    case "email-required":
      return { field: "email", message: messages.errors.authEmailRequired };
    case "email-shape":
      return { field: "email", message: messages.errors.authEmailShape };
    case "email-taken":
      return { field: "email", message: messages.errors.authEmailTaken };
    case "password-required":
      return { field: "password", message: messages.errors.authPasswordRequired };
    case "password-too-short":
      return { field: "password", message: messages.errors.authPasswordTooShort };
    case "confirm-required":
      return { field: "confirm", message: messages.errors.authConfirmRequired };
    case "password-mismatch":
      return { field: "confirm", message: messages.errors.authPasswordMismatch };
    // Not beside either field, on purpose: putting it under the password would
    // say the email was fine, which is the disclosure AC-ACCT-002.2 forbids.
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
