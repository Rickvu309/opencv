/**
 * Waitlist-specific codes and copy. The address check itself lives in
 * `lib/email.ts` so accounts can use it without importing this module.
 */

import type { Msg } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import type { EmailProblem } from "@/lib/email";

export { checkEmail, normalizeEmail, type EmailProblem } from "@/lib/email";

/**
 * What to show the person who typed it.
 */
export function emailProblemMessage(problem: EmailProblem): Msg {
  switch (problem) {
    case "empty":
      return messages.errors.waitlistEmailEmpty;
    case "too-long":
      return messages.errors.waitlistEmailTooLong;
    case "shape":
      return messages.errors.waitlistEmailShape;
  }
}

/** The wire format between the API and the client: stable, not a sentence. */
export type WaitlistErrorCode =
  | "email-empty"
  | "email-shape"
  | "email-too-long"
  | "bad-request"
  | "rate-limited"
  | "store-down";

export function problemCode(problem: EmailProblem): WaitlistErrorCode {
  return problem === "empty"
    ? "email-empty"
    : problem === "too-long"
      ? "email-too-long"
      : "email-shape";
}
